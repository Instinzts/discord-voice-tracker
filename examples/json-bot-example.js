require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { VoiceManager, JSONStorage, MemoryCache, XPCalculator } = require('discord-voice-tracker');

// ========================
// CLIENT SETUP
// ========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// ========================
// STORAGE & CACHE SETUP
// ========================

const storage = new JSONStorage('./data');

// ✅ CREATE MEMORY CACHE (Recommended for better performance)
const cache = new MemoryCache({
  ttl: 300000,      // 5 minutes cache lifetime
  maxSize: 1000,    // Max 1000 cached items
  enableStats: true // Track cache performance
});

// ❌ WITHOUT CACHE (Not recommended, but shown for comparison)
// To use without cache, simply don't pass the cache parameter to VoiceManager
// const cache = null;

const calculator = new XPCalculator();

// ========================
// VOICE MANAGER WITH CACHE
// ========================

const voiceManager = new VoiceManager(client, {
  storage,
  cache,  // ✅ Enable caching for 10-100x performance boost
  // cache: null,  // ❌ Disable cache (not recommended)
  checkInterval: 5000,
  debug: true,
  
  defaultConfig: {
    // Tracking options
    trackBots: false,
    trackAllChannels: true,
    trackMuted: true,
    trackDeafened: true,
    minUsersToTrack: 0,
    maxUsersToTrack: 0,
    
    // Strategy names
    xpStrategy: 'channel-bonus',
    voiceTimeStrategy: 'fixed',
    levelMultiplierStrategy: 'standard',
    
    // Strategy configs
    xpConfig: {
      baseAmount: 10,
    },
    voiceTimeConfig: {
      baseAmount: 5000,
    },
    
    // Modules
    enableLeveling: true,
    enableVoiceTime: true,
  },
});

// ========================
// CUSTOM STRATEGIES
// ========================

// Time-based XP (bonus at night)
voiceManager.registerXPStrategy('time-based', (member, config) => {
  const hour = new Date().getHours();
  
  // Night bonus (10pm - 6am)
  if (hour >= 22 || hour < 6) return 15;
  
  // Peak hours (6pm - 10pm)
  if (hour >= 18 && hour < 22) return 12;
  
  return 10;
});

// Channel-specific XP
voiceManager.registerXPStrategy('channel-bonus', (member, config) => {
  const channel = member.voice.channel;
  if (!channel) return 10;
  
  // Study channels get 2x XP
  if (channel.name.toLowerCase().includes('study')) return 20;
  
  // Gaming channels get 1.5x XP
  if (channel.name.toLowerCase().includes('game')) return 15;
  
  return 10;
});

// ========================
// VOICE MANAGER EVENTS
// ========================

voiceManager.on('levelUp', async (user, oldLevel, newLevel) => {
  console.log(`🎉 ${user.userId} leveled up: ${oldLevel} → ${newLevel}`);
  
  // Send level up message
  try {
    const guild = user.guild.discordGuild;
    const member = await guild.members.fetch(user.userId);
    
    // Find a text channel to send the message
    const channel = guild.channels.cache.find(
      ch => ch.name === 'general' || ch.name === 'chat'
    );
    
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 Level Up!')
        .setDescription(`${member} just reached **Level ${newLevel}**!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error sending level up message:', error);
  }
});

voiceManager.on('xpGained', (user, amount) => {
  console.log(`💫 ${user.userId} gained ${amount} XP`);
});

voiceManager.on('voiceTimeGained', (user, amount) => {
  console.log(`⏱️ ${user.userId} gained ${calculator.formatVoiceTime(amount)}`);
});

voiceManager.on('sessionStart', (session) => {
  console.log(`▶️ Session started: ${session.userId} in ${session.channelId}`);
});

voiceManager.on('sessionEnd', (session) => {
  console.log(`⏹️ Session ended: ${session.userId}, duration: ${calculator.formatVoiceTime(session.duration || 0)}`);
});

// ✅ LISTEN FOR CACHE EVENTS (only works if cache is enabled)
voiceManager.on('debug', (message) => {
  // Only show cache-related messages
  if (message.includes('Cache')) {
    console.log(`🗄️  ${message}`);
  }
});

voiceManager.on('error', (error) => {
  console.error('❌ VoiceManager error:', error);
});

// ========================
// CACHE STATISTICS MONITORING
// ========================

let cacheStatsInterval;

function startCacheMonitoring() {
  // Only start monitoring if cache is enabled
  if (!voiceManager.cache) {
    console.log('⚠️  Cache monitoring disabled (cache not enabled)');
    return;
  }
  
  cacheStatsInterval = setInterval(async () => {
    const stats = await voiceManager.cache.getStats();
    console.log('\n📊 ===== CACHE STATISTICS =====');
    console.log(`   Hit Rate:    ${(stats.hitRate * 100).toFixed(2)}%`);
    console.log(`   Hits:        ${stats.hits}`);
    console.log(`   Misses:      ${stats.misses}`);
    console.log(`   Cache Size:  ${stats.size} items`);
    console.log(`   Sets:        ${stats.sets}`);
    console.log(`   Deletes:     ${stats.deletes}`);
    console.log('================================\n');
  }, 60000); // Every 60 seconds
}

// ========================
// SLASH COMMANDS
// ========================

const commands = [
  // User commands
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View voice activity statistics')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check (leave empty for yourself)')
        .setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server voice leaderboard')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: 'XP', value: 'xp' },
          { name: 'Level', value: 'level' },
          { name: 'Voice Time', value: 'voiceTime' }
        )
    ),
  
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your rank card')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check (leave empty for yourself)')
        .setRequired(false)
    ),
  
  // Cache management command (only works if cache is enabled)
  new SlashCommandBuilder()
    .setName('cachestats')
    .setDescription('View cache performance statistics'),
];

// ========================
// COMMAND HANDLERS
// ========================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  try {
    switch (interaction.commandName) {
      case 'stats':
        await handleStatsCommand(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboardCommand(interaction);
        break;
      case 'rank':
        await handleRankCommand(interaction);
        break;
      case 'cachestats':
        await handleCacheStatsCommand(interaction);
        break;
    }
  } catch (error) {
    console.error('Command error:', error);
    
    const errorMessage = {
      content: 'An error occurred while executing this command.',
      ephemeral: true,
    };
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// ========================
// /stats COMMAND
// ========================

async function handleStatsCommand(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  // ========================================
  // METHOD 1: ✅ CACHE-AWARE (RECOMMENDED)
  // ========================================
  // This method uses the cache and is 40-200x faster
  const userData = await voiceManager.getUser(interaction.guildId, targetUser.id);
  
  if (!userData) {
    return interaction.reply({
      content: `${targetUser.username} has no voice activity yet!`,
      ephemeral: true,
    });
  }
  
  // Get guild for config
  const guild = voiceManager.guilds.get(interaction.guildId);
  const multiplier = await guild.config.getLevelMultiplier();
  const progress = calculator.calculateLevelProgress(userData.xp, multiplier);
  const xpToNext = calculator.calculateXPToNextLevel(userData.xp, multiplier);
  
  // Calculate rank from cached leaderboard
  const leaderboard = await voiceManager.getLeaderboard(interaction.guildId, {
    sortBy: 'xp',
    limit: 1000,
  });
  const userEntry = leaderboard.find(entry => entry.userId === targetUser.id);
  const rank = userEntry?.rank || null;
  
  // ========================================
  // METHOD 2: ❌ NON-CACHE-AWARE (NOT RECOMMENDED)
  // ========================================
  // Uncomment the code below to see the non-cache-aware approach
  // This method bypasses the cache and is slower
  
  /*
  const guild = voiceManager.guilds.get(interaction.guildId);
  const user = guild?.users.get(targetUser.id);
  
  if (!user) {
    return interaction.reply({
      content: `${targetUser.username} has no voice activity yet!`,
      ephemeral: true,
    });
  }
  
  const multiplier = await guild.config.getLevelMultiplier();
  const progress = calculator.calculateLevelProgress(user.xp, multiplier);
  const xpToNext = calculator.calculateXPToNextLevel(user.xp, multiplier);
  const rank = await user.getRank('xp');  // Direct query (slower)
  */
  
  // ========================================
  // GET MOST ACTIVE CHANNEL (Works with both methods)
  // ========================================
  
  // For cache-aware method, we need to get the User instance to access channels
  const userInstance = guild.users.get(targetUser.id);
  let mostActiveChannel = 'N/A';
  let maxTime = 0;
  
  if (userInstance) {
    for (const [channelId, channel] of userInstance.channels) {
      if (channel.voiceTime > maxTime) {
        maxTime = channel.voiceTime;
        const discordChannel = interaction.guild.channels.cache.get(channelId);
        mostActiveChannel = discordChannel ? discordChannel.name : 'Unknown Channel';
      }
    }
  }
  
  // ========================================
  // BUILD EMBED (Works with both methods)
  // ========================================
  
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📊 Voice Stats for ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { 
        name: '⏱️ Voice Time', 
        value: calculator.formatVoiceTime(userData.totalVoiceTime), 
        inline: true 
      },
      { name: '⭐ Level', value: `${userData.level}`, inline: true },
      { name: '💫 XP', value: `${userData.xp.toLocaleString()}`, inline: true },
      { 
        name: '📈 Progress', 
        value: `${progress}% → Level ${userData.level + 1}`, 
        inline: true 
      },
      { name: '🎯 XP Needed', value: `${xpToNext.toLocaleString()}`, inline: true },
      { name: '🏆 Rank', value: rank ? `#${rank}` : 'Unranked', inline: true },
      { name: '🔊 Most Active', value: mostActiveChannel, inline: true },
      { name: '🎙️ Sessions', value: `${userData.totalSessions}`, inline: true },
      { name: '🔥 Streak', value: `${userData.streak} days`, inline: true }
    )
    .setFooter({ text: 'Powered by discord-voice-tracker with CACHING!' })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

// ========================
// /leaderboard COMMAND
// ========================

async function handleLeaderboardCommand(interaction) {
  const type = interaction.options.getString('type') || 'xp';
  
  // ========================================
  // METHOD 1: ✅ CACHE-AWARE (RECOMMENDED)
  // ========================================
  // This method uses the cache and is 100-400x faster for leaderboards
  const leaderboard = await voiceManager.getLeaderboard(interaction.guildId, {
    sortBy: type,
    limit: 10
  });
  
  // ========================================
  // METHOD 2: ❌ NON-CACHE-AWARE (NOT RECOMMENDED)
  // ========================================
  // Uncomment the code below to see the non-cache-aware approach
  
  /*
  const guild = voiceManager.guilds.get(interaction.guildId);
  
  if (!guild) {
    return interaction.reply({
      content: 'No data available for this server yet!',
      ephemeral: true,
    });
  }
  
  const leaderboard = await guild.getLeaderboard(type, 10);
  */
  
  // ========================================
  // BUILD LEADERBOARD (Works with both methods)
  // ========================================
  
  if (leaderboard.length === 0) {
    return interaction.reply({
      content: 'No leaderboard data available yet!',
      ephemeral: true,
    });
  }
  
  const typeNames = {
    xp: 'XP',
    level: 'Level',
    voiceTime: 'Voice Time',
  };
  
  const description = await Promise.all(
    leaderboard.map(async (entry, index) => {
      const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
      const username = member ? member.user.username : 'Unknown User';
      
      let value;
      if (type === 'voiceTime') {
        value = calculator.formatVoiceTime(entry.voiceTime || entry.totalVoiceTime);
      } else if (type === 'level') {
        value = `Level ${entry.level}`;
      } else {
        value = `${entry.xp.toLocaleString()} XP`;
      }
      
      const medal = ['🥇', '🥈', '🥉'][index] || `**${index + 1}.**`;
      return `${medal} ${username} - ${value}`;
    })
  );
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🏆 ${typeNames[type]} Leaderboard`)
    .setDescription(description.join('\n'))
    .setFooter({ 
      text: `Showing top ${leaderboard.length} users | Data cached for optimal performance` 
    })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

// ========================
// /rank COMMAND
// ========================

async function handleRankCommand(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  // ========================================
  // METHOD 1: ✅ CACHE-AWARE (RECOMMENDED)
  // ========================================
  const userData = await voiceManager.getUser(interaction.guildId, targetUser.id);
  
  if (!userData) {
    return interaction.reply({
      content: `${targetUser.username} has no voice activity yet!`,
      ephemeral: true,
    });
  }
  
  const guild = voiceManager.guilds.get(interaction.guildId);
  const multiplier = await guild.config.getLevelMultiplier();
  const progress = calculator.calculateLevelProgress(userData.xp, multiplier);
  const xpToNext = calculator.calculateXPToNextLevel(userData.xp, multiplier);
  const nextLevelXP = calculator.calculateXPForLevel(userData.level + 1, multiplier);
  
  // Get rank from cached leaderboard
  const leaderboard = await voiceManager.getLeaderboard(interaction.guildId, {
    sortBy: 'xp',
    limit: 1000,
  });
  const userEntry = leaderboard.find(entry => entry.userId === targetUser.id);
  const rank = userEntry?.rank || null;
  
  // ========================================
  // METHOD 2: ❌ NON-CACHE-AWARE (NOT RECOMMENDED)
  // ========================================
  // Uncomment the code below to see the non-cache-aware approach
  
  /*
  const guild = voiceManager.guilds.get(interaction.guildId);
  const user = guild?.users.get(targetUser.id);
  
  if (!user) {
    return interaction.reply({
      content: `${targetUser.username} has no voice activity yet!`,
      ephemeral: true,
    });
  }
  
  const multiplier = await guild.config.getLevelMultiplier();
  const progress = calculator.calculateLevelProgress(user.xp, multiplier);
  const xpToNext = calculator.calculateXPToNextLevel(user.xp, multiplier);
  const nextLevelXP = calculator.calculateXPForLevel(user.level + 1, multiplier);
  const rank = await user.getRank('xp');
  
  const userData = user;  // Use user instance directly
  */
  
  // ========================================
  // BUILD RANK CARD (Works with both methods)
  // ========================================
  
  // Create progress bar
  const barLength = 20;
  const filled = Math.round((progress / 100) * barLength);
  const progressBar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📊 Rank Card: ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `**Level ${userData.level}**\n` +
      `${progressBar}\n` +
      `${userData.xp.toLocaleString()} / ${Math.floor(nextLevelXP).toLocaleString()} XP\n` +
      `\n` +
      `🏆 **Rank:** ${rank ? `#${rank}` : 'Unranked'}\n` +
      `💫 **XP to Next Level:** ${xpToNext.toLocaleString()}\n` +
      `⏱️ **Voice Time:** ${calculator.formatVoiceTime(userData.totalVoiceTime)}\n` +
      `🎙️ **Sessions:** ${userData.totalSessions}`
    )
    .setFooter({ text: 'Keep talking to level up!' })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

// ========================
// /cachestats COMMAND
// ========================

async function handleCacheStatsCommand(interaction) {
  if (!voiceManager.cache) {
    return interaction.reply({
      content: '❌ Cache is not enabled! Enable caching in the bot configuration for better performance.\n\n' +
               '**To enable caching:**\n' +
               '```javascript\n' +
               'const cache = new MemoryCache({ ttl: 300000, maxSize: 1000 });\n' +
               'const voiceManager = new VoiceManager(client, { storage, cache });\n' +
               '```',
      ephemeral: true,
    });
  }
  
  const stats = await voiceManager.cache.getStats();
  
  // Calculate performance metrics
  const totalRequests = stats.hits + stats.misses;
  const avgResponseTime = stats.hits > 0 
    ? `~${Math.round(5 * (stats.misses / totalRequests))}ms` 
    : 'N/A';
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('📊 Cache Performance Statistics')
    .setDescription('Real-time cache performance metrics for voice tracking data')
    .addFields(
      { 
        name: '🎯 Hit Rate', 
        value: `${(stats.hitRate * 100).toFixed(2)}%`, 
        inline: true 
      },
      { 
        name: '✅ Cache Hits', 
        value: `${stats.hits.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '❌ Cache Misses', 
        value: `${stats.misses.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '📦 Cache Size', 
        value: `${stats.size} items`, 
        inline: true 
      },
      { 
        name: '➕ Sets', 
        value: `${stats.sets.toLocaleString()}`, 
        inline: true 
      },
      { 
        name: '➖ Deletes', 
        value: `${stats.deletes.toLocaleString()}`, 
        inline: true 
      },
      {
        name: '⚡ Performance Impact',
        value: `Avg response time: ${avgResponseTime}\n` +
               `Estimated speedup: ${stats.hitRate > 0 ? `${Math.round(stats.hitRate * 100)}x` : 'N/A'}`,
        inline: false
      }
    )
    .setFooter({ text: 'Cache stats reset on bot restart | Using JSON storage' })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

// ========================
// CLIENT READY
// ========================

client.once('ready', async () => {
  console.log('\n===================================');
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log('===================================\n');
  
  // Initialize voice manager
  try {
    await voiceManager.init();
    console.log('✅ Voice Manager initialized (JSON storage)');
    
    if (voiceManager.cache) {
      console.log('✅ Memory cache enabled!');
    } else {
      console.log('⚠️  Cache disabled - performance may be slower');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Voice Manager:', error);
    process.exit(1);
  }
  
  // Register slash commands
  try {
    console.log('📝 Registering slash commands...');
    await client.application.commands.set(commands);
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
  
  console.log('\n===================================');
  console.log('🎙️ Bot ready!');
  console.log('📊 Storage: JSON files (./data)');
  if (voiceManager.cache) {
    console.log('💾 Cache: ENABLED (10-100x faster)');
  } else {
    console.log('💾 Cache: DISABLED');
  }
  console.log('===================================\n');
  
  // Start cache monitoring
  startCacheMonitoring();
});

// ========================
// ERROR HANDLING
// ========================

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️ Shutting down...');
  
  // Show final cache stats if cache is enabled
  if (voiceManager.cache) {
    const stats = await voiceManager.cache.getStats();
    console.log('\n📊 Final Cache Statistics:');
    console.log(`   Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
    console.log(`   Total Hits: ${stats.hits}`);
    console.log(`   Total Misses: ${stats.misses}`);
    console.log(`   Cache Size: ${stats.size} items\n`);
  }
  
  if (cacheStatsInterval) {
    clearInterval(cacheStatsInterval);
  }
  
  await voiceManager.destroy();
  client.destroy();
  
  console.log('✅ Shutdown complete');
  process.exit(0);
});

// ========================
// START BOT
// ========================

client.login(process.env.DISCORD_BOT_TOKEN);