// examples/mongodb-bot-example.js
// Complete example using MongoDB storage with custom schemas for dynamic XP

require('dotenv').config();
const mongoose = require('mongoose');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder,
  PermissionFlagsBits 
} = require('discord.js');
const { VoiceManager, MongoStorage, XPCalculator } = require('discord-voice-tracker');

// ===== CUSTOM MONGODB SCHEMAS =====

// Schema for guild settings (YOUR custom database)
const GuildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  vipRoleId: String,
  boosterRoleId: String,
  xpMultiplier: { type: Number, default: 1 },
  bonusChannels: [String], // Channels that give bonus XP
  createdAt: { type: Date, default: Date.now },
});

const GuildSettings = mongoose.model('GuildSettings', GuildSettingsSchema);

// ===== CONNECT TO YOUR MONGODB =====
mongoose.connect(process.env.MONGODB_URI, {
  dbName: 'your_bot_database', // YOUR database for schemas
}).then(() => {
  console.log('✅ Connected to MongoDB (Custom Schemas)');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ===== DISCORD CLIENT SETUP =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// ===== STORAGE SETUP =====
// Voice tracker uses SEPARATE MongoDB database
const storage = new MongoStorage(
  process.env.MONGODB_URI,
  'voicetracker' // Separate database for voice data
);

// ===== VOICE MANAGER SETUP =====
const voiceManager = new VoiceManager(client, {
  storage,
  debug: true,
  checkInterval: 5000,
  
  defaultConfig: {
    trackBots: false,
    trackAllChannels: true,
    trackMuted: true,
    trackDeafened: true,
    
    // 🔥 DYNAMIC XP - Uses YOUR MongoDB schemas!
    xpPerCheck: async (member, config) => {
      try {
        // ✅ Fetch from YOUR custom database
        const settings = await GuildSettings.findOne({ 
          guildId: member.guild.id 
        });
        
        if (!settings) {
          console.log(`⚠️ No settings found for ${member.guild.name}, using default XP`);
          return 10; // Default XP
        }
        
        let baseXP = 10;
        
        // Check if member has booster role from YOUR schema
        if (settings.boosterRoleId && member.roles.cache.has(settings.boosterRoleId)) {
          baseXP = 20;
          console.log(`🚀 Booster ${member.user.username} gets ${baseXP} XP!`);
        }
        // Check if member has VIP role from YOUR schema
        else if (settings.vipRoleId && member.roles.cache.has(settings.vipRoleId)) {
          baseXP = 15;
          console.log(`⭐ VIP ${member.user.username} gets ${baseXP} XP!`);
        }
        
        // Apply multiplier from YOUR schema
        const finalXP = Math.floor(baseXP * settings.xpMultiplier);
        
        return finalXP;
        
      } catch (error) {
        console.error('Error fetching guild settings:', error);
        return 10; // Fallback to default
      }
    },
    
    // 🔥 DYNAMIC VOICE TIME - Bonus for specific channels
    voiceTimePerCheck: async (config) => {
      try {
        const guild = config.guild;
        const settings = await GuildSettings.findOne({ 
          guildId: guild.guildId 
        });
        
        // Check if user is in a bonus channel
        const voiceChannel = guild.guild?.members.cache
          .find(m => m.voice.channel)?.voice.channel;
        
        if (settings?.bonusChannels?.includes(voiceChannel?.id)) {
          console.log(`⚡ Bonus channel detected! 2x voice time`);
          return 10000; // 10 seconds instead of 5
        }
        
        return 5000; // Normal 5 seconds
        
      } catch (error) {
        console.error('Error in voiceTimePerCheck:', error);
        return 5000;
      }
    },
    
    levelMultiplier: 0.1,
    enableLeveling: true,
    enableVoiceTime: true,
  },
});

const calculator = new XPCalculator();

// ===== EVENT LISTENERS =====

voiceManager.on('levelUp', async (user, oldLevel, newLevel) => {
  console.log(`🎉 ${user.userId} leveled up: ${oldLevel} → ${newLevel}`);
  
  try {
    const guild = client.guilds.cache.get(user.guildId);
    const member = await guild.members.fetch(user.userId);
    const channel = guild.channels.cache.find(ch => ch.name === 'general');
    
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 Level Up!')
        .setDescription(`${member} reached **Level ${newLevel}**!`)
        .addFields(
          { name: '💫 XP', value: user.xp.toString(), inline: true },
          { name: '⏱️ Voice Time', value: calculator.formatVoiceTime(user.totalVoiceTime), inline: true }
        )
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error sending level up message:', error);
  }
});

// ===== SLASH COMMANDS =====

const commands = [
  // Stats command
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View voice activity statistics')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check').setRequired(false)
    ),
  
  // Leaderboard command
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the voice activity leaderboard')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Leaderboard type')
        .addChoices(
          { name: '⏱️ Voice Time', value: 'voiceTime' },
          { name: '💫 XP', value: 'xp' },
          { name: '⭐ Level', value: 'level' }
        )
    ),
  
  // 🔥 NEW: Set VIP role (stores in YOUR MongoDB)
  new SlashCommandBuilder()
    .setName('setviprole')
    .setDescription('Set the VIP role that gets bonus XP (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The VIP role')
        .setRequired(true)
    ),
  
  // 🔥 NEW: Set booster role
  new SlashCommandBuilder()
    .setName('setboosterrole')
    .setDescription('Set the booster role (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The booster role')
        .setRequired(true)
    ),
  
  // 🔥 NEW: Set XP multiplier
  new SlashCommandBuilder()
    .setName('setmultiplier')
    .setDescription('Set XP multiplier for the server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addNumberOption(option =>
      option
        .setName('multiplier')
        .setDescription('Multiplier (e.g., 2.0 for double XP)')
        .setRequired(true)
        .setMinValue(0.5)
        .setMaxValue(5)
    ),
  
  // 🔥 NEW: Add bonus channel
  new SlashCommandBuilder()
    .setName('addbonuschannel')
    .setDescription('Add a channel that gives bonus voice time (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The voice channel')
        .setRequired(true)
    ),
  
  // 🔥 NEW: View current settings
  new SlashCommandBuilder()
    .setName('viewsettings')
    .setDescription('View current XP settings'),
    
].map(cmd => cmd.toJSON());

// ===== COMMAND HANDLERS =====

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    // Stats command
    if (interaction.commandName === 'stats') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guild = voiceManager.guilds.get(interaction.guildId);
      
      if (!guild) {
        return interaction.reply({ content: '❌ Guild not found', ephemeral: true });
      }
      
      const user = guild.users.get(targetUser.id);
      
      if (!user) {
        return interaction.reply({ 
          content: `${targetUser.username} has no voice activity yet.`, 
          ephemeral: true 
        });
      }

      const multiplier = await guild.config.getLevelMultiplier();
      const progress = calculator.calculateLevelProgress(user.xp, multiplier);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📊 Voice Stats for ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⏱️ Voice Time', value: calculator.formatVoiceTime(user.totalVoiceTime), inline: true },
          { name: '⭐ Level', value: `${user.level}`, inline: true },
          { name: '💫 XP', value: `${user.xp}`, inline: true },
          { name: '📈 Progress', value: `${progress}%`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    }
    
    // Leaderboard command
    else if (interaction.commandName === 'leaderboard') {
      const type = interaction.options.getString('type') || 'xp';
      const leaderboard = await voiceManager.getLeaderboard(interaction.guildId, {
        sortBy: type,
        limit: 10,
      });

      if (leaderboard.length === 0) {
        return interaction.reply({ content: 'No users on leaderboard yet.', ephemeral: true });
      }

      const description = await Promise.all(
        leaderboard.map(async (entry, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '▫️';
          const user = await client.users.fetch(entry.userId).catch(() => null);
          const username = user?.username || 'Unknown';
          
          let value;
          if (type === 'voiceTime') value = calculator.formatVoiceTime(entry.voiceTime);
          else if (type === 'xp') value = `${entry.xp} XP`;
          else value = `Level ${entry.level}`;
          
          return `${medal} **#${entry.rank}** ${username} - ${value}`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Voice Leaderboard')
        .setDescription(description.join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
    
    // 🔥 Set VIP role command
    else if (interaction.commandName === 'setviprole') {
      const role = interaction.options.getRole('role');
      
      // Save to YOUR MongoDB database
      await GuildSettings.findOneAndUpdate(
        { guildId: interaction.guildId },
        { vipRoleId: role.id },
        { upsert: true, new: true }
      );
      
      await interaction.reply({
        content: `✅ VIP role set to ${role}! Members with this role will get 15 XP per check.`,
        ephemeral: true,
      });
    }
    
    // 🔥 Set booster role command
    else if (interaction.commandName === 'setboosterrole') {
      const role = interaction.options.getRole('role');
      
      await GuildSettings.findOneAndUpdate(
        { guildId: interaction.guildId },
        { boosterRoleId: role.id },
        { upsert: true, new: true }
      );
      
      await interaction.reply({
        content: `✅ Booster role set to ${role}! Members with this role will get 20 XP per check.`,
        ephemeral: true,
      });
    }
    
    // 🔥 Set multiplier command
    else if (interaction.commandName === 'setmultiplier') {
      const multiplier = interaction.options.getNumber('multiplier');
      
      await GuildSettings.findOneAndUpdate(
        { guildId: interaction.guildId },
        { xpMultiplier: multiplier },
        { upsert: true, new: true }
      );
      
      await interaction.reply({
        content: `✅ XP multiplier set to **${multiplier}x**!`,
        ephemeral: true,
      });
    }
    
    // 🔥 Add bonus channel command
    else if (interaction.commandName === 'addbonuschannel') {
      const channel = interaction.options.getChannel('channel');
      
      await GuildSettings.findOneAndUpdate(
        { guildId: interaction.guildId },
        { $addToSet: { bonusChannels: channel.id } },
        { upsert: true, new: true }
      );
      
      await interaction.reply({
        content: `✅ ${channel} added as bonus channel! Users in this channel will gain voice time 2x faster.`,
        ephemeral: true,
      });
    }
    
    // 🔥 View settings command
    else if (interaction.commandName === 'viewsettings') {
      const settings = await GuildSettings.findOne({ 
        guildId: interaction.guildId 
      });
      
      if (!settings) {
        return interaction.reply({
          content: 'No custom settings configured yet. Using defaults.',
          ephemeral: true,
        });
      }
      
      const vipRole = settings.vipRoleId ? `<@&${settings.vipRoleId}>` : 'Not set';
      const boosterRole = settings.boosterRoleId ? `<@&${settings.boosterRoleId}>` : 'Not set';
      const bonusChannels = settings.bonusChannels?.map(id => `<#${id}>`).join(', ') || 'None';
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚙️ Current XP Settings')
        .addFields(
          { name: '⭐ VIP Role', value: vipRole, inline: true },
          { name: '🚀 Booster Role', value: boosterRole, inline: true },
          { name: '📊 XP Multiplier', value: `${settings.xpMultiplier}x`, inline: true },
          { name: '⚡ Bonus Channels', value: bonusChannels, inline: false }
        )
        .setFooter({ text: 'These settings are stored in YOUR MongoDB database' });
      
      await interaction.reply({ embeds: [embed] });
    }
    
  } catch (error) {
    console.error('Command error:', error);
    const msg = { content: '❌ An error occurred', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

// ===== BOT READY =====

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  await voiceManager.init();
  console.log('✅ Voice Manager initialized');

  await client.application.commands.set(commands);
  console.log('✅ Commands registered');
  
  console.log('\n📊 Status:');
  console.log(`   Voice Storage: MongoDB (voicetracker db)`);
  console.log(`   Custom Schemas: MongoDB (your_bot_database)`);
  console.log(`   Guilds: ${voiceManager.guilds.size}`);
  console.log(`   Dynamic XP: Enabled ✅`);
  console.log(`   Schema Integration: Enabled ✅\n`);
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await voiceManager.destroy();
  await mongoose.disconnect();
  client.destroy();
  process.exit(0);
});