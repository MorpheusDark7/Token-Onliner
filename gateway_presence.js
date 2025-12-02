const fs = require("fs");
const WebSocket = require("ws");
const chalk = require("chalk");

const OPCodes = {
  Dispatch: 0,
  Heartbeat: 1,
  Identify: 2,
  PresenceUpdate: 3,
  VoiceStateUpdate: 4,
  Resume: 6,
  Reconnect: 7,
  RequestGuildMembers: 8,
  InvalidSession: 9,
  Hello: 10,
  HeartbeatACK: 11,
};

const DiscordIntents = {
  GUILDS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  GUILD_MODERATION: 1 << 2,
  GUILD_EMOJIS_AND_STICKERS: 1 << 3,
  GUILD_INTEGRATIONS: 1 << 4,
  GUILD_WEBHOOKS: 1 << 5,
  GUILD_INVITES: 1 << 6,
  GUILD_VOICE_STATES: 1 << 7,
  GUILD_PRESENCES: 1 << 8,
  GUILD_MESSAGES: 1 << 9,
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  GUILD_MESSAGE_TYPING: 1 << 11,
  DIRECT_MESSAGES: 1 << 12,
  DIRECT_MESSAGE_REACTIONS: 1 << 13,
  DIRECT_MESSAGE_TYPING: 1 << 14,
  MESSAGE_CONTENT: 1 << 15,
  GUILD_SCHEDULED_EVENTS: 1 << 16,
  AUTO_MODERATION_CONFIGURATION: 1 << 20,
  AUTO_MODERATION_EXECUTION: 1 << 21,
};

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function plog(symbol, text, username = "", extra = "") {
  console.log(
    `[${symbol}] ${text.toString().padEnd(30)} ${String(username).padEnd(
      24
    )} ${extra}`
  );
}

class Presence {
  constructor(online_status) {
    this.online_status = online_status;
    this.activities = [];
  }
  addActivity(name, activity_type, url = null) {
    this.activities.push({
      name,
      type: activity_type,
      url: activity_type === 1 ? url : null,
    });
  }
  removeActivity(index) {
    if (index < 0 || index >= this.activities.length) return false;
    this.activities.splice(index, 1);
    return true;
  }
}

class GatewayConnection {
  constructor(token, presence, identifyDelay = 0) {
    this.token = token;
    this.presence = presence;
    this.ws = null;

    this.heartbeatIntervalMS = null;
    this.heartbeatTimer = null;
    this.lastHeartbeatAck = true;
    this.heartbeatSeq = null;

    this.sessionId = null;
    this.username = null;

   
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 60_000;

    
    this.identifyDelay = identifyDelay;
  }

  start() {
    return new Promise((resolve) => {
      
      this.ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");

   
      this.ws.on("open", () => {
        plog("🔌", "Socket opened", "-", "");
      });

      this.ws.on("message", (raw) => {
        let packet;
        try {
          packet = JSON.parse(raw.toString());
        } catch (err) {
          console.error("Failed to parse incoming packet", err);
          return;
        }
        this._handlePacket(packet);
      });

      this.ws.on("error", (err) => {
        plog("❗", "Socket error", "-", err.message || err);
      });

      this.ws.on("close", (code, reason) => {
        plog("🛑", `Socket closed (${code})`, "-", reason?.toString?.() || "");
        this._cleanupHeartbeat();
      
        this._reconnectWithBackoff();
      });

     
      resolve();
    });
  }

  _handlePacket(packet) {
    const op = packet.op;
 
    if (packet.s !== null && packet.s !== undefined) {
      this.heartbeatSeq = packet.s;
    }

    switch (op) {
      case OPCodes.Hello:
        {
        
          const interval = packet.d && packet.d.heartbeat_interval;
          if (interval) {
            this._startHeartbeat(interval);
          }
         
          setTimeout(() => this._identify(), this.identifyDelay);
        }
        break;

      case OPCodes.HeartbeatACK:
        this.lastHeartbeatAck = true;
        break;

      case OPCodes.Heartbeat:
      
        this._send({
          op: OPCodes.Heartbeat,
          d: this.heartbeatSeq || null,
        });
        break;

      case OPCodes.Dispatch:
    
        if (packet.t === "READY") {
          this.sessionId = packet.d.session_id;
          if (packet.d.user && packet.d.user.username) {
            this.username = packet.d.user.username;
          }
          plog("🔑", "Authenticated", this.username, "");
          
          this.reconnectAttempts = 0;
        } else if (packet.t === "INVALID_SESSION") {
          plog("⚠️", "Invalid session received", this.username || "-", "");
          
          const resumable = packet.d === true;
          if (!resumable) {
            
            setTimeout(() => this._identify(), 2_000 + Math.random() * 3_000);
          } else {
           
            this.ws.terminate();
          }
        }
        
        break;

      case OPCodes.InvalidSession:
        
        plog("⚠️", "InvalidSession op", this.username || "-", "");
        break;

      default:
        
        break;
    }
  }

  _startHeartbeat(ms) {
    
    this._cleanupHeartbeat();
    this.heartbeatIntervalMS = ms;
   
    this.heartbeatTimer = setInterval(() => {
      if (!this.lastHeartbeatAck) {
        
        plog("⚠️", "Heartbeat not ACK'd - reconnecting", this.username || "-", "");
        try {
          this.ws.terminate();
        } catch (e) {}
        return;
      }
      this.lastHeartbeatAck = false;
      this._send({ op: OPCodes.Heartbeat, d: this.heartbeatSeq || null });
      
      //log("💓", `Heartbeat sent`, this.username || "-", `${this.heartbeatIntervalMS}ms`);
    }, ms);
  }

  _cleanupHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.lastHeartbeatAck = true;
  }

  _identify() {
    
    const payload = {
      op: OPCodes.Identify,
      d: {
        token: this.token,
        intents: DiscordIntents.GUILD_MESSAGES | DiscordIntents.GUILDS,
        properties: {
          os: "linux",
          browser: "node",
          device: "pc",
        },
        presence: {
          activities: this.presence.activities,
          status: this.presence.online_status,
          since: Date.now(),
          afk: false,
        },
      },
    };
    try {
      this._send(payload);
    } catch (err) {
      plog("❗", "Failed to send IDENTIFY", "-", err.message || err);
    }
  }

  _send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }

  async _reconnectWithBackoff() {
    this._cleanupHeartbeat();

    this.reconnectAttempts += 1;
    const attempt = this.reconnectAttempts;

   
    const base = Math.min(30_000, 1000 * Math.pow(2, Math.min(attempt, 6)));
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(this.maxReconnectDelay, base + jitter);

    plog("⏳", `Reconnect attempt #${attempt} in ${Math.round(delay)}ms`, this.username || "-", "");
    await sleep(delay);

    try {
      
      this.connectNewSocket();
    } catch (err) {
      plog("❗", "Reconnect failed to start", "-", err.message || err);
 
      this._reconnectWithBackoff();
    }
  }

  connectNewSocket() {
   
    try {
      this.ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
     
      this.ws.on("open", () => {
        plog("🔌", "Reconnected socket opened", "-", "");
      });

      this.ws.on("message", (raw) => {
        let packet;
        try {
          packet = JSON.parse(raw.toString());
        } catch (err) {
          console.error("Failed to parse incoming packet", err);
          return;
        }
        this._handlePacket(packet);
      });

      this.ws.on("error", (err) => {
        plog("❗", "Socket error", "-", err.message || err);
      });

      this.ws.on("close", (code, reason) => {
        plog("🛑", `Socket closed (${code})`, "-", reason?.toString?.() || "");
        this._cleanupHeartbeat();
        this._reconnectWithBackoff();
      });
    } catch (err) {
      throw err;
    }
  }

  stop() {
    this._cleanupHeartbeat();
    try {
      if (this.ws) this.ws.close();
    } catch (e) {}
  }
}

// small console intro
function intro(tokens) {
  console.log(
    chalk.green("Morphy's Onliner ") +
      chalk.magenta("Epic ") +
      chalk.cyan("[Multiple Accounts] ") +
      chalk.red(`Total Accounts: ${tokens.length}`)
  );
}

async function run() {
  try {
    const tokens = fs
      .readFileSync("tokens.txt", "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!tokens.length) {
      console.error("No tokens in tokens.txt");
      process.exit(1);
    }

    const raw = fs.readFileSync("config.json", "utf8");
    const config = JSON.parse(raw);

    const activity_types =
      config.choose_random_activity_type_from.map((t) => t.toUpperCase()) || [];
    const online_statuses =
      config.choose_random_online_status_from.map((s) => s.toUpperCase()) || [];

   
    const Activity = {
      GAME: 0,
      STREAMING: 1,
      LISTENING: 2,
      WATCHING: 3,
      CUSTOM: 4,
      COMPETING: 5,
    };

    intro(tokens);

    
    const connections = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
    
      const online_status_key =
        online_statuses[Math.floor(Math.random() * online_statuses.length)] || "ONLINE";
      
      const statusMap = {
        ONLINE: "online",
        DND: "dnd",
        IDLE: "idle",
        INVISIBLE: "invisible",
        OFFLINE: "offline",
      };
      const online_status = statusMap[online_status_key] || "online";

      const chosenActivityName = activity_types[
        Math.floor(Math.random() * activity_types.length)
      ];

      let chosenActivity = Activity.GAME;
      if (chosenActivityName && Activity[chosenActivityName] !== undefined) {
        chosenActivity = Activity[chosenActivityName];
      }

      let name = "Playing";
      let url = null;
      switch (chosenActivity) {
        case Activity.GAME:
          name =
            config.game.choose_random_game_from[
              Math.floor(Math.random() * config.game.choose_random_game_from.length)
            ];
          break;
        case Activity.STREAMING:
          name =
            config.streaming.choose_random_name_from[
              Math.floor(Math.random() * config.streaming.choose_random_name_from.length)
            ];
          url =
            config.streaming.choose_random_url_from[
              Math.floor(Math.random() * config.streaming.choose_random_url_from.length)
            ];
          break;
        case Activity.LISTENING:
          name =
            config.listening.choose_random_name_from[
              Math.floor(Math.random() * config.listening.choose_random_name_from.length)
            ];
          break;
        case Activity.WATCHING:
          name =
            config.watching.choose_random_name_from[
              Math.floor(Math.random() * config.watching.choose_random_name_from.length)
            ];
          break;
        case Activity.CUSTOM:
          name =
            config.custom.choose_random_name_from[
              Math.floor(Math.random() * config.custom.choose_random_name_from.length)
            ];
          break;
        case Activity.COMPETING:
          name =
            config.competing.choose_random_name_from[
              Math.floor(Math.random() * config.competing.choose_random_name_from.length)
            ];
          break;
      }

      const presence = new Presence(online_status);
      presence.addActivity(name, chosenActivity, url);

     
      const identifyDelay = i * 1200 + Math.floor(Math.random() * 500);
      const conn = new GatewayConnection(token, presence, identifyDelay);
      connections.push(conn);

      
      conn.start();
      
      await sleep(150);
    }


    process.stdin.resume();

  
    process.on("SIGINT", () => {
      plog("🧾", "Shutting down...", "-", "");
      for (const c of connections) c.stop();
      process.exit(0);
    });
  } catch (err) {
    console.error("Fatal error:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

run();
