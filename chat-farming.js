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
var tmi_js_1 = __importDefault(require("tmi.js"));
var ChatFarmingService = /** @class */ (function () {
    function ChatFarmingService(db) {
        this.clients = new Map();
        this.farmingIntervals = new Map();
        this.db = db;
    }
    ChatFarmingService.prototype.startAccount = function (account) {
        return __awaiter(this, void 0, void 0, function () {
            var channels, channelNames_1, client_1, interval, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log("[CHAT FARMING] Starting chat farming for: ".concat(account.username));
                        channels = this.db.prepare('SELECT streamer FROM followed_channels WHERE account_id = ? AND status IS NOT NULL').all(account.id);
                        if (channels.length === 0) {
                            console.log("[CHAT FARMING] No channels found for ".concat(account.username));
                            this.logActivity(account.id, 'info', "No channels to farm");
                            return [2 /*return*/];
                        }
                        channelNames_1 = channels.map(function (c) { return c.streamer; });
                        console.log("[CHAT FARMING] Farming ".concat(channelNames_1.length, " channels for ").concat(account.username));
                        client_1 = new tmi_js_1.default.Client({
                            options: { debug: false },
                            identity: {
                                username: account.username,
                                password: "oauth:".concat(account.access_token)
                            },
                            channels: channelNames_1
                        });
                        // Connect to chat
                        return [4 /*yield*/, client_1.connect()];
                    case 1:
                        // Connect to chat
                        _a.sent();
                        console.log("[CHAT FARMING] Connected to chat for ".concat(account.username));
                        this.clients.set(account.id, client_1);
                        this.logActivity(account.id, 'info', "Connected to ".concat(channelNames_1.length, " channels"));
                        interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                            var _i, channelNames_2, channel, currentPoints, newPoints, err_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 5, , 6]);
                                        _i = 0, channelNames_2 = channelNames_1;
                                        _a.label = 1;
                                    case 1:
                                        if (!(_i < channelNames_2.length)) return [3 /*break*/, 4];
                                        channel = channelNames_2[_i];
                                        // Send a message to claim points
                                        return [4 /*yield*/, client_1.say(channel, "!points")];
                                    case 2:
                                        // Send a message to claim points
                                        _a.sent();
                                        currentPoints = this.db.prepare('SELECT points FROM followed_channels WHERE account_id = ? AND streamer = ?').get(account.id, channel);
                                        if (currentPoints) {
                                            newPoints = (currentPoints.points || 0) + 10;
                                            this.db.prepare('UPDATE followed_channels SET points = ? WHERE account_id = ? AND streamer = ?').run(newPoints, account.id, channel);
                                        }
                                        _a.label = 3;
                                    case 3:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 4:
                                        console.log("[CHAT FARMING] Points claimed for ".concat(account.username));
                                        this.logActivity(account.id, 'info', "Points claimed successfully");
                                        return [3 /*break*/, 6];
                                    case 5:
                                        err_1 = _a.sent();
                                        console.error("[CHAT FARMING] Error claiming points:", err_1);
                                        return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); }, 5 * 60 * 1000);
                        this.farmingIntervals.set(account.id, interval);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error("[CHAT FARMING] Failed to start farming for ".concat(account.username, ":"), error_1);
                        this.logActivity(account.id, 'error', "Failed to start: ".concat(error_1.message));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ChatFarmingService.prototype.stopAccount = function (accountId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, interval, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        client = this.clients.get(accountId);
                        interval = this.farmingIntervals.get(accountId);
                        if (interval) {
                            clearInterval(interval);
                            this.farmingIntervals.delete(accountId);
                        }
                        if (!client) return [3 /*break*/, 2];
                        return [4 /*yield*/, client.disconnect()];
                    case 1:
                        _a.sent();
                        this.clients.delete(accountId);
                        _a.label = 2;
                    case 2:
                        console.log("[CHAT FARMING] Stopped farming for account ".concat(accountId));
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error("[CHAT FARMING] Error stopping farming:", error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ChatFarmingService.prototype.logActivity = function (accountId, type, message) {
        try {
            this.db.prepare('INSERT INTO logs (streamer_id, type, message, time) VALUES (?, ?, ?, datetime("now"))').run(accountId, type, message);
        }
        catch (err) {
            // Ignore log errors
        }
    };
    return ChatFarmingService;
}());
exports.default = ChatFarmingService;
