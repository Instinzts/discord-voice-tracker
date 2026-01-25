// examples/json-bot-example.js
// Complete example using JSON storage with dynamic XP system

require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder 
} = require('discord.js');
const { VoiceManager, JSONStorage, XPCalculator } = require('discord-voice-tracker');

// ===== DISCORD CLIENT SETUP =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// ===== STORAGE SETUP =====
const storage = new JSONStorage('./data');

// ===== VOICE MANAGER SETUP =====
const voiceManager = new VoiceManager(client, {
  storage,
  debug: true,
  checkInterval: 5000, // Check every 5 seconds
  
  defaultConfig: {
    trackBots: false,
    trackAllChannels: true,
    trackMuted: true,
    trackDeafened: true,
    
    // 🔥 DYNAMIC XP - Changes based on member properties
    xpPerCheck: (member, config) => {
      // Boosters get 2x XP
      if (member.premiumSince) {
        console.log(`🚀 Booster ${member.user.username} gets 20 XP!`);
        return 20;
      }
      
      // VIP role gets 1.5x XP
      if (member.roles.cache.some(r => r.name === 'VIP')) {
        console.log(`⭐ VIP ${member.user.username} gets 15 XP!`);
        return 15;
      }
      
      // Default XP
      return 10;
    },
    
    voiceTimePerCheck: 5000, // 5 seconds
    levelMultiplier: 0.1,
    enableLeveling: true,
    enableVoiceTime: true,
  },
});

const calculator = new XPCalculator();

// ===== EVENT LISTENERS =====

// Level Up Event
voiceManager.on('levelUp', async (user, oldLevel, newLevel) => {
  console.log(`🎉 ${user.userId} leveled up: ${oldLevel} → ${newLevel}`);
  
  try {
    const guild = client.guilds.cache.get(user.guildId);
    const member = await guild.members.fetch(user.userId);
    
    // Find announcement channel
    const channel = guild.channels.cache.find(
      ch => ch.name === 'general' || ch.name === 'chat'
    );
    
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

// Session Events
voiceManager.on('sessionStart', (session) => {
  console.log(`🎙️ Session started: ${session.userId}`);
});

voiceManager.on('sessionEnd', (session) => {
  const duration = calculator.formatVoiceTime(session.duration || 0);
  console.log(`🔴 Session ended: ${session.userId}, Duration: ${duration}, XP: ${session.xpEarned}`);
});

// ===== SLASH COMMANDS =====

const commands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View voice activity statistics')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check').setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the voice activity leaderboard')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: '⏱️ Voice Time', value: 'voiceTime' },
          { name: '💫 XP', value: 'xp' },
          { name: '⭐ Level', value: 'level' }
        )
    ),
  
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your server rank'),
].map(cmd => cmd.toJSON());

// ===== COMMAND HANDLERS =====

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
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
      const xpToNext = calculator.calculateXPToNextLevel(user.xp, multiplier);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📊 Voice Stats for ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⏱️ Voice Time', value: calculator.formatVoiceTime(user.totalVoiceTime), inline: true },
          { name: '⭐ Level', value: `${user.level}`, inline: true },
          { name: '💫 XP', value: `${user.xp}`, inline: true },
          { name: '📈 Progress', value: `${progress}% (${xpToNext} XP to next level)`, inline: false }
        );

      await interaction.reply({ embeds: [embed] });
    }
    
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
    
    else if (interaction.commandName === 'rank') {
      const guild = voiceManager.guilds.get(interaction.guildId);
      const user = guild?.users.get(interaction.user.id);
      
      if (!user) {
        return interaction.reply({ content: 'You are not ranked yet.', ephemeral: true });
      }

      const rank = await user.getRank('xp');

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🏅 Your Rank`)
        .addFields(
          { name: '🏅 Rank', value: rank ? `#${rank}` : 'Unranked', inline: true },
          { name: '⭐ Level', value: `${user.level}`, inline: true },
          { name: '💫 XP', value: `${user.xp}`, inline: true }
        );

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
  console.log(`   Storage: JSON (./data)`);
  console.log(`   Guilds: ${voiceManager.guilds.size}`);
  console.log(`   Dynamic XP: Enabled ✅\n`);
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await voiceManager.destroy();
  client.destroy();
  process.exit(0);
});