# Discord Voice Tracker

> 🎙️ A modern, production-ready voice activity tracking system for Discord bots with XP, leveling, and comprehensive statistics.

[![npm version](https://img.shields.io/npm/v/discord-voice-tracker?style=flat-square)](https://www.npmjs.com/package/discord-voice-tracker)
[![npm downloads](https://img.shields.io/npm/dt/discord-voice-tracker?style=flat-square)](https://www.npmjs.com/package/discord-voice-tracker)
[![License](https://img.shields.io/npm/l/discord-voice-tracker?style=flat-square)](LICENSE)
[![Node Version](https://img.shields.io/node/v/discord-voice-tracker?style=flat-square)](https://nodejs.org)

---

## ✨ Features

- 🎯 **Voice Time Tracking** - Track total and per-channel voice activity
- 💫 **XP & Leveling System** - Automatic XP gain and level progression
- 🔥 **Strategy Pattern System** - Secure, flexible XP calculation
- 📊 **Statistics & Analytics** - Detailed user stats and session history
- 🏆 **Leaderboards** - Rank users by voice time, XP, or level
- ⚙️ **Highly Configurable** - Customize tracking behavior per guild
- 💾 **Multiple Storage Options** - JSON (built-in) and MongoDB support
- 🗄️ **MongoDB Schema Integration** - Use your own database schemas for custom logic
- 🔒 **Secure by Design** - No eval(), no code injection vulnerabilities
- 📝 **TypeScript Support** - Full type definitions included
- 🚀 **Production Ready** - Optimized performance with caching
- 📦 **Easy Integration** - Simple setup with sensible defaults

---

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Strategy Examples](#-strategy-examples)
- [Slash Commands](#-slash-commands)
- [Configuration](#-configuration)
- [Events](#-events)
- [API Reference](#-api-reference)
- [Storage Options](#-storage-options)
- [Troubleshooting](#-troubleshooting)

---

## 📦 Installation

### Prerequisites

- **Node.js 18.0.0 or higher** - [Download here](https://nodejs.org/)
- **A Discord Bot** - [Create one here](https://discord.com/developers/applications)

### Install Package
```bash
npm install discord-voice-tracker discord.js
```

### Optional: MongoDB
```bash
npm install mongodb mongoose
```

---

## 🚀 Quick Start

### Basic Setup (5 minutes)
```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { VoiceManager, JSONStorage } = require('discord-voice-tracker');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Create storage
const storage = new JSONStorage('./data');

// Create voice manager
const voiceManager = new VoiceManager(client, {
  storage,
  checkInterval: 5000,
  debug: true,
  defaultConfig: {
    trackBots: false,
    trackAllChannels: true,
    
    // Use strategy names
    xpStrategy: 'fixed',
    voiceTimeStrategy: 'fixed',
    levelMultiplierStrategy: 'standard',
    
    // Strategy configurations
    xpConfig: { baseAmount: 10 },
    voiceTimeConfig: { baseAmount: 5000 },
  },
});

// Listen for level ups
voiceManager.on('levelUp', (user, oldLevel, newLevel) => {
  console.log(`🎉 ${user.userId} leveled up to ${newLevel}!`);
});

// Initialize
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await voiceManager.init();
  console.log('✅ Voice tracking active!');
});

client.login('YOUR_BOT_TOKEN');
```

**Run it:**
```bash
node bot.js
```

---

## 🔥 Strategy Examples

### Built-in Strategies
```javascript
// Fixed XP (default)
defaultConfig: {
  xpStrategy: 'fixed',
  xpConfig: { baseAmount: 10 }
}

// Role-based XP
defaultConfig: {
  xpStrategy: 'role-based',
  xpConfig: {
    baseAmount: 5,
    roles: {
      '123456789': 15,  // VIP role
      '987654321': 20,  // Premium role
    }
  }
}

// Booster bonus
defaultConfig: {
  xpStrategy: 'booster-bonus',
  xpConfig: {
    baseAmount: 10,
    boosterMultiplier: 2  // 2x for boosters
  }
}

// Random XP
defaultConfig: {
  xpStrategy: 'random',
  xpConfig: {
    minXP: 5,
    maxXP: 15
  }
}
```

### Custom Strategy (Simple)
```javascript
const voiceManager = new VoiceManager(client, { storage });

// Register custom strategy
voiceManager.registerXPStrategy('time-based', (member, config) => {
  const hour = new Date().getHours();
  
  // Night bonus (10pm - 6am)
  if (hour >= 22 || hour < 6) return 15;
  
  // Peak hours (6pm - 10pm)
  if (hour >= 18 && hour < 22) return 12;
  
  return 10;
});

// Initialize
await voiceManager.init();

// Use the strategy
const guild = voiceManager.guilds.get(guildId);
await guild.config.edit({
  xpStrategy: 'time-based'
});
```

### MongoDB Integration (Advanced)
```javascript
const mongoose = require('mongoose');
const { VoiceManager, MongoStorage } = require('discord-voice-tracker');

// 1. Your custom schema
const GuildSettingsSchema = new mongoose.Schema({
  guildId: String,
  vipRoleId: String,
  boosterRoleId: String,
  xpMultiplier: { type: Number, default: 1 },
});

const GuildSettings = mongoose.model('GuildSettings', GuildSettingsSchema);

// 2. Connect to YOUR database
await mongoose.connect(process.env.MONGODB_URI, {
  dbName: 'your_bot_database'
});

// 3. Create voice tracker (separate database)
const storage = new MongoStorage(
  process.env.MONGODB_URI,
  'voicetracker'
);

const voiceManager = new VoiceManager(client, { storage });

// 4. Register strategy using YOUR schema
voiceManager.registerXPStrategy('guild-settings-xp', async (member, config) => {
  const settings = await GuildSettings.findOne({
    guildId: member.guild.id
  });
  
  if (!settings) return 10;
  
  let xp = 10;
  
  // VIP role
  if (settings.vipRoleId && member.roles.cache.has(settings.vipRoleId)) {
    xp = 15;
  }
  
  // Booster role
  if (settings.boosterRoleId && member.roles.cache.has(settings.boosterRoleId)) {
    xp = 20;
  }
  
  // Apply multiplier
  return Math.floor(xp * settings.xpMultiplier);
});

// 5. Initialize
await voiceManager.init();
```

**📖 Complete MongoDB example: [examples/mongodb-bot-example.js](https://github.com/Instinzts/discord-voice-tracker/blob/main/examples/mongodb-bot-example.js)**

---

## 💬 Slash Commands

### Example: `/stats` Command
```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { XPCalculator } = require('discord-voice-tracker');

const calculator = new XPCalculator();

const statsCommand = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View voice activity statistics')
  .addUserOption(option =>
    option.setName('user').setDescription('User to check').setRequired(false)
  );

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'stats') return;

  const targetUser = interaction.options.getUser('user') || interaction.user;
  
  // Use Guild class
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
  const rank = await user.getRank('xp');

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📊 Voice Stats for ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '⏱️ Voice Time', value: calculator.formatVoiceTime(user.totalVoiceTime), inline: true },
      { name: '⭐ Level', value: `${user.level}`, inline: true },
      { name: '💫 XP', value: `${user.xp.toLocaleString()}`, inline: true },
      { name: '📈 Progress', value: `${progress}% → Level ${user.level + 1}`, inline: true },
      { name: '🎯 XP Needed', value: `${xpToNext.toLocaleString()}`, inline: true },
      { name: '🏆 Rank', value: rank ? `#${rank}` : 'Unranked', inline: true }
    )
    .setFooter({ text: 'Powered by discord-voice-tracker' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
});
```

---

## ⚙️ Configuration

### Manager Options
```javascript
const voiceManager = new VoiceManager(client, {
  storage: storage,              // Required: JSONStorage or MongoStorage
  checkInterval: 5000,           // Check every 5 seconds
  debug: false,                  // Enable debug logging
  
  defaultConfig: {
    // Tracking
    trackBots: false,
    trackAllChannels: true,
    trackMuted: true,
    trackDeafened: true,
    
    // Filters
    channelIds: [],
    minUsersToTrack: 0,
    maxUsersToTrack: 0,
    exemptPermissions: [],
    
    // Strategy names (not functions)
    xpStrategy: 'fixed',
    voiceTimeStrategy: 'fixed',
    levelMultiplierStrategy: 'standard',
    
    // Strategy configurations
    xpConfig: {
      baseAmount: 10,
      // Custom properties for your strategies
    },
    voiceTimeConfig: {
      baseAmount: 5000,
    },
    levelMultiplierConfig: {
      baseMultiplier: 0.1,
    },
    
    // Runtime filters (functions allowed here, not serialized)
    memberFilter: (member) => true,
    channelFilter: (channel) => true,
    
    // Modules
    enableLeveling: true,
    enableVoiceTime: true,
  },
});
```

### Registering Strategies
```javascript
// Register BEFORE voiceManager.init()

// XP Strategy
voiceManager.registerXPStrategy('my-xp', (member, config) => {
  // Your logic
  return 10;
});

// Voice Time Strategy
voiceManager.registerVoiceTimeStrategy('my-time', (config) => {
  // Your logic
  return 5000;
});

// Level Multiplier Strategy
voiceManager.registerLevelMultiplierStrategy('my-multiplier', (config) => {
  // Your logic
  return 0.1;
});
```

### Per-Guild Configuration
```javascript
const guild = voiceManager.guilds.get(guildId);

// Edit config
await guild.config.edit({
  trackBots: true,
  xpStrategy: 'booster-bonus',
  xpConfig: {
    baseAmount: 15,
    boosterMultiplier: 2
  }
});

// Get dynamic values
const xp = await guild.config.getXpToAdd(member);
const voiceTime = await guild.config.getVoiceTimeToAdd();
const multiplier = await guild.config.getLevelMultiplier();
```

---

## 🎯 Events
```javascript
// Level up
voiceManager.on('levelUp', (user, oldLevel, newLevel) => {
  console.log(`User leveled up: ${oldLevel} → ${newLevel}`);
});

// XP gained
voiceManager.on('xpGained', (user, amount) => {
  console.log(`User gained ${amount} XP`);
});

// Voice time gained
voiceManager.on('voiceTimeGained', (user, amount) => {
  console.log(`User gained ${amount}ms voice time`);
});

// Session events
voiceManager.on('sessionStart', (session) => {
  console.log('Session started');
});

voiceManager.on('sessionEnd', (session) => {
  console.log(`Session ended: ${session.duration}ms`);
});

// Config updated
voiceManager.on('configUpdated', (guildId, config) => {
  console.log('Config updated');
});

// Errors
voiceManager.on('error', (error) => {
  console.error('Error:', error);
});
```

---

## 📚 API Reference

### VoiceManager
```javascript
// Initialize
await voiceManager.init();

// Register strategies (before init)
voiceManager.registerXPStrategy(name, calculator);
voiceManager.registerVoiceTimeStrategy(name, calculator);
voiceManager.registerLevelMultiplierStrategy(name, calculator);

// Get guild
const guild = voiceManager.guilds.get(guildId);

// Get user (legacy)
const userData = await voiceManager.getUser(guildId, userId);

// Update user
await voiceManager.updateUser(guildId, userId, {
  addVoiceTime: 60000,
  addXp: 100,
  setLevel: 5,
});

// Leaderboard
const leaderboard = await voiceManager.getLeaderboard(guildId, {
  sortBy: 'xp',
  limit: 10,
});

// Destroy
await voiceManager.destroy();
```

### Guild Class
```javascript
const guild = voiceManager.guilds.get(guildId);

// Get or create user
const user = await guild.getOrCreateUser(userId);

// Get leaderboard
const leaderboard = await guild.getLeaderboard('xp', 10);

// Edit config
await guild.config.edit({
  xpStrategy: 'custom-xp',
  xpConfig: { baseAmount: 15 }
});

// Save
await guild.save();
```

### User Class
```javascript
const user = guild.users.get(userId);

// Add XP
await user.addXP(100);

// Add voice time
await user.addVoiceTime(60000, channelId);

// Set level
await user.setLevel(10);

// Get rank
const rank = await user.getRank('xp');

// Reset
await user.reset();
```

### Config Class
```javascript
const config = guild.config;

// Get dynamic values
const xp = await config.getXpToAdd(member);
const voiceTime = await config.getVoiceTimeToAdd();
const multiplier = await config.getLevelMultiplier();

// Check filters
const shouldTrack = await config.checkMember(member);
const shouldTrackChannel = await config.checkChannel(channel);

// Edit
await config.edit({
  xpStrategy: 'new-strategy',
  xpConfig: { baseAmount: 20 }
});
```

### XPCalculator
```javascript
const { XPCalculator } = require('discord-voice-tracker');
const calculator = new XPCalculator();

calculator.calculateLevel(1000, 0.1);              // → 10
calculator.calculateXPForLevel(10, 0.1);           // → 1000
calculator.calculateXPToNextLevel(1500, 0.1);      // → 610
calculator.calculateLevelProgress(1500, 0.1);      // → 22
calculator.formatVoiceTime(3661000);               // → "1h 1m 1s"
```

---

## 💾 Storage Options

### JSON Storage
```javascript
const { JSONStorage } = require('discord-voice-tracker');
const storage = new JSONStorage('./data');
```

**Pros:** No dependencies, easy to inspect, simple backup  
**Cons:** Not suitable for 1000+ users

### MongoDB Storage
```javascript
const { MongoStorage } = require('discord-voice-tracker');
const storage = new MongoStorage(
  'mongodb://localhost:27017',
  'voicetracker'
);
```

**Pros:** Scalable, fast queries, concurrent writes  
**Cons:** Requires MongoDB server

---

## 🛠️ Troubleshooting

### "Strategy not found" Error
```javascript
// ❌ Error: Strategy 'my-xp' not found
defaultConfig: {
  xpStrategy: 'my-xp'  // Not registered!
}

// ✅ Fix: Register before using
voiceManager.registerXPStrategy('my-xp', (member) => 10);
```

### Voice Tracking Not Working

**Checklist:**
1. ✅ Correct intents: `Guilds`, `GuildVoiceStates`
2. ✅ Called `await voiceManager.init()`
3. ✅ User is in voice channel
4. ✅ Wait 5-10 seconds

**Enable debug:**
```javascript
const voiceManager = new VoiceManager(client, {
  storage,
  debug: true,
});
```

### TypeError: Cannot read property 'users' of undefined
```javascript
// ❌ Wrong
const userData = await voiceManager.getUser(guildId, userId);

// ✅ Correct
const guild = voiceManager.guilds.get(guildId);
const user = guild?.users.get(userId);
```

---

## 📖 Documentation

- **[Examples](https://github.com/Instinzts/discord-voice-tracker/tree/main/examples)** - Complete working examples

---

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](https://github.com/Instinzts/discord-voice-tracker/blob/main/CONTRIBUTING.md)

---

## 📄 License

MIT License - see [LICENSE](https://github.com/Instinzts/discord-voice-tracker/blob/main/LICENSE) file

---

## 🙏 Support

- 📖 [Documentation](https://github.com/Instinzts/discord-voice-tracker)
- 🐛 [Report Issues](https://github.com/Instinzts/discord-voice-tracker/issues)
- 💬 [Discord Server](https://discord.gg/Kf5kC5s8ha)
- ⭐ Star on GitHub if you find this useful!

---

**Made with ❤️ by [Async](https://github.com/Instinzts)**