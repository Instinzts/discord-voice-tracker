# Discord Voice Tracker - Examples

This folder contains complete, working examples showing how to use `discord-voice-tracker` in different scenarios.

---

## 📁 Available Examples

### **1. JSON Storage Example** (`json-bot-example.js`)
- File-based storage (no database required)
- **With caching** for 10-100x faster performance
- Custom strategies
- Slash commands (`/stats`, `/leaderboard`, `/cachestats`)
- Perfect for small to medium bots

**Use this if:**
- ✅ Bot has < 10 guilds
- ✅ < 1000 users per guild
- ✅ You want simple setup
- ✅ No external database

### **2. MongoDB Example** (`mongodb-custom-bot-example.js`)
- MongoDB Atlas or local MongoDB
- **With caching** for production performance
- Custom Mongoose schemas
- Advanced guild configuration
- Perfect for production bots

**Use this if:**
- ✅ Bot has 10+ guilds
- ✅ 1000+ users per guild
- ✅ You need scalability
- ✅ You want custom database schemas

---

## 🚀 Quick Start

### **Step 1: Choose Your Example**

**Small Bot?** → Use `json-bot-example.js`  
**Production Bot?** → Use `mongodb-custom-bot-example.js`

### **Step 2: Install Dependencies**

```bash
# For JSON example
npm install discord.js discord-voice-tracker dotenv

# For MongoDB example (additional)
npm install mongodb mongoose
```

### **Step 3: Configure Environment**

Create a `.env` file:

```env
# Required for both examples
DISCORD_BOT_TOKEN=your_bot_token_here

# Only for MongoDB example
MONGODB_URI=mongodb://localhost:27017
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

### **Step 4: Run**

```bash
# JSON example
node json-bot-example.js

# MongoDB example
node mongodb-custom-bot-example.js
```

---

## ⚡ What's New in v1.1.0

All examples now include **high-performance caching**:

```javascript
// ⭐ NEW: Memory caching for 10-100x performance
const cache = new MemoryCache({
  ttl: 300000,      // 5 minutes
  maxSize: 1000,    // Max items
  enableStats: true // Track performance
});

const voiceManager = new VoiceManager(client, {
  storage,
  cache,  // ⭐ Enable caching
  checkInterval: 5000
});
```

**Performance Improvements:**
- User queries: **40-200x faster**
- Leaderboards: **100-400x faster**
- Database load: **95% reduction**

---

## 📊 Available Commands

All examples include these slash commands:

### **/stats [user]**
View voice activity statistics for a user
- Voice time
- Level & XP
- Progress to next level
- Server rank

### **/leaderboard**
View the server leaderboard
- Top 10 users by XP/level/voice time
- Sortable by different metrics

### **/cachestats** ⭐ NEW!
View cache performance statistics
- Hit rate (target: 70-85%)
- Cache hits/misses
- Cache size

---

## 🎯 Key Features Shown

### **JSON Example**
- Basic setup with file storage
- Custom XP strategies
- Event handling
- Cache monitoring
- Statistics tracking

### **MongoDB Example**
- MongoDB connection
- Custom Mongoose schemas
- Database-driven XP strategies
- Guild-specific configuration
- Advanced cache usage

---

## 📚 Full Documentation

For complete documentation, see the **[main README.md](../readme.md)** in the package root.

**Topics covered:**
- Installation guide
- Caching system (NEW!)
- Strategy system
- Storage options
- Configuration
- API reference
- Troubleshooting

---

## 💡 Common Patterns

### **1. Cache-Aware Commands**
```javascript
// ✅ RECOMMENDED (cache-aware)
const userData = await voiceManager.getUser(guildId, userId);
const leaderboard = await voiceManager.getLeaderboard(guildId, { sortBy: 'xp' });

// ⚠️ OLD (bypasses cache)
const guild = voiceManager.guilds.get(guildId);
const user = guild.users.get(userId);
```

### **2. Custom Strategies**
```javascript
// Register BEFORE init()
voiceManager.registerXPStrategy('my-strategy', async (member, config) => {
  // Your custom logic here
  return 10;
});

await voiceManager.init();

// Use in config
await guild.config.edit({ xpStrategy: 'my-strategy' });
```

### **3. Cache Monitoring**
```javascript
// Display cache stats every 60 seconds
setInterval(async () => {
  const stats = await voiceManager.cache.getStats();
  console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}, 60000);
```

---

## 🔧 Customization

All examples can be customized:

**Change XP rates:**
```javascript
defaultConfig: {
  xpStrategy: 'fixed',
  xpConfig: { baseAmount: 20 }  // 20 XP per check
}
```

**Change cache settings:**
```javascript
const cache = new MemoryCache({
  ttl: 600000,   // 10 minutes (longer cache)
  maxSize: 2000  // More items
});
```

**Add custom strategies:**
```javascript
voiceManager.registerXPStrategy('weekend-bonus', (member) => {
  const day = new Date().getDay();
  return (day === 0 || day === 6) ? 20 : 10;  // 2x on weekends
});
```

---

## 🐛 Troubleshooting

### **Cache Not Working?**
Check console for cache messages:
```
🗄️  Cache MISS: user:123:456
🗄️  Cache HIT: user:123:456  ← Should see these!
```

If you only see MISS:
- Make sure `cache` is passed to VoiceManager
- Update commands to use `voiceManager.getUser()`
- Wait 1-2 minutes for cache to warm up

### **Low Hit Rate?**
```javascript
const stats = await voiceManager.cache.getStats();
console.log(stats.hitRate);  // Should be 0.7-0.85
```

If low:
- Increase TTL: `new MemoryCache({ ttl: 600000 })`
- Check commands use cache-aware methods
- Monitor for longer (30+ minutes)

---

## 📖 Learn More

- **Main Documentation & Caching Guide**: [../README.md](../readme.md)
- **Changelog**: [../CHANGELOG.md](../CHANGELOG.md)
- **GitHub**: [https://github.com/Instinzts/discord-voice-tracker](https://github.com/Instinzts/discord-voice-tracker)

---

## 🙏 Support

Questions? Issues?
- 🐛 [Report Issues](https://github.com/Instinzts/discord-voice-tracker/issues)
- 💬 [Discord Server](https://discord.gg/Kf5kC5s8ha)
- ⭐ Star the repo if helpful!

---

**Made with ❤️ by [Async](https://github.com/Instinzts)**