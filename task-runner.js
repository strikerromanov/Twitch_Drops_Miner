"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// setInterval and clearInterval are global in Node.js
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var tmi_js_1 = __importDefault(require("tmi.js"));
var ws_1 = __importDefault(require("ws"));
var db = new better_sqlite3_1.default('./data/farm.db');
var TaskRunner = /** @class */ (function () {
    function TaskRunner() {
        this.intervals = new Map();
        this.chatClients = new Map();
        this.websocket = null;
        this.initialize();
    }
    TaskRunner.prototype.initialize = function () {
        console.log('[TASK RUNNER] Initializing...');
        // Start continuous loops
        this.startFarmingLoop();
        this.startDropIndexingLoop();
        this.startChatConnections();
        this.connectTwitchWebSocket();
        console.log('[TASK RUNNER] All loops started');
    };
    TaskRunner.prototype.startFarmingLoop = function () {
        var _this = this;
        // Run every 30 seconds
        var interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.checkStreamers()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.claimPoints()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.updateStreams()];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error('[TASK RUNNER] Farming loop error:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); }, 30000);
        this.intervals.set('farming', interval);
        console.log('[TASK RUNNER] Farming loop started (30s interval)');
    };
    TaskRunner.prototype.checkStreamers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var streamers, _i, streamers_1, streamer;
            return __generator(this, function (_a) {
                streamers = db.prepare('SELECT id, username, access_token, status FROM accounts WHERE status = ?').all('farming');
                console.log("[TASK RUNNER] Checking ".concat(streamers.length, " farming streamers"));
                for (_i = 0, streamers_1 = streamers; _i < streamers_1.length; _i++) {
                    streamer = streamers_1[_i];
                    // Check if streamer is live
                    // Fetch stream info from Twitch API
                    // Update database
                    // Log activity
                    this.logActivity(streamer.id, 'info', "Checked ".concat(streamer.username));
                }
                return [2 /*return*/];
            });
        });
    };
    TaskRunner.prototype.claimPoints = function () {
        return __awaiter(this, void 0, void 0, function () {
            var streamers, _i, streamers_2, streamer, client;
            return __generator(this, function (_a) {
                streamers = db.prepare('SELECT id, username, access_token FROM accounts WHERE status = ?').all('farming');
                for (_i = 0, streamers_2 = streamers; _i < streamers_2.length; _i++) {
                    streamer = streamers_2[_i];
                    client = this.chatClients.get(streamer.id);
                    if (client) {
                        // Send chat message to trigger point claim
                        client.say(streamer.username, '!points');
                        this.logActivity(streamer.id, 'points', "Claimed points for ".concat(streamer.username));
                    }
                }
                return [2 /*return*/];
            });
        });
    };
    TaskRunner.prototype.updateStreams = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    TaskRunner.prototype.startDropIndexingLoop = function () {
        var _this = this;
        // Run every 5 minutes
        var interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.indexDrops()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        console.error('[TASK RUNNER] Drop indexing error:', error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, 300000);
        this.intervals.set('drops', interval);
        console.log('[TASK RUNNER] Drop indexing loop started (5min interval)');
    };
    TaskRunner.prototype.indexDrops = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log('[TASK RUNNER] Indexing drops from twitch.tv/drops/campaigns');
                // Fetch campaigns
                // Parse game list
                // Update database
                this.logSystem('info', 'Indexed drop campaigns');
                return [2 /*return*/];
            });
        });
    };
    TaskRunner.prototype.startChatConnections = function () {
        var streamers = db.prepare('SELECT id, username, access_token FROM accounts WHERE status = ?').all('farming');
        for (var _i = 0, streamers_3 = streamers; _i < streamers_3.length; _i++) {
            var streamer = streamers_3[_i];
            this.connectChat(streamer);
        }
    };
    TaskRunner.prototype.connectChat = function (streamer) {
        var client = new tmi_js_1.default.Client({
            channels: [streamer.username],
            connection: {
                secure: true,
                reconnect: true
            }
        });
        client.connect();
        this.chatClients.set(streamer.id, client);
        console.log("[TASK RUNNER] Connected to chat: ".concat(streamer.username));
        // Handle messages
        client.on('message', function (channel, tags, message, self) {
            console.log("[CHAT] ".concat(channel, ": ").concat(message));
            // Process chat events
            // Detect bonus claims
            // Update points
        });
    };
    TaskRunner.prototype.connectTwitchWebSocket = function () {
        var ws = new ws_1.default('wss://pubsub-edge.twitch.tv');
        ws.on('open', function () {
            console.log('[TASK RUNNER] Connected to Twitch WebSocket');
            // Listen for topics
            // Subscribe to channel points
        });
        ws.on('message', function (data) {
            console.log('[WS] Received message');
            // Parse PubSub messages
            // Handle channel points events
            // Handle drop progress events
        });
        this.websocket = ws;
    };
    TaskRunner.prototype.logActivity = function (streamerId, type, message) {
        try {
            db.prepare('INSERT INTO logs (streamer_id, type, message, time) VALUES (?, ?, ?, datetime("now"))').run(streamerId, type, message);
            console.log("[LOG] ".concat(type.toUpperCase(), ": ").concat(message));
        }
        catch (error) {
            console.error('[LOG] Failed to log activity:', error);
        }
    };
    TaskRunner.prototype.logSystem = function (type, message) {
        try {
            db.prepare('INSERT INTO logs (type, message, time) VALUES (?, ?, datetime("now"))').run(type, message);
            console.log("[LOG] ".concat(type.toUpperCase(), ": ").concat(message));
        }
        catch (error) {
            console.error('[LOG] Failed to log system message:', error);
        }
    };
    TaskRunner.prototype.stop = function () {
        // Clear all intervals
        this.intervals.forEach(function (interval) { return clearInterval(interval); });
        this.intervals.clear();
        // Disconnect all chat clients
        this.chatClients.forEach(function (client) { return client.disconnect(); });
        this.chatClients.clear();
        // Close WebSocket
        if (this.websocket) {
            this.websocket.close();
        }
        console.log('[TASK RUNNER] Stopped all loops');
    };
    return TaskRunner;
}());
// Initialize task runner
var taskRunner = new TaskRunner();
// Cleanup on exit
process.on('SIGINT', function () {
    taskRunner.stop();
    process.exit(0);
});
exports.default = taskRunner;
