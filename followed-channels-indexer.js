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
var node_fetch_1 = __importDefault(require("node-fetch"));
var FollowedChannelsIndexer = /** @class */ (function () {
    function FollowedChannelsIndexer(db, clientId) {
        this.indexingInterval = null;
        this.db = db;
        this.clientId = clientId;
    }
    FollowedChannelsIndexer.prototype.indexAccount = function (accountId) {
        return __awaiter(this, void 0, void 0, function () {
            var account, follows, pagination, response, data, added, _i, follows_1, channel, existing, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        account = this.db.prepare('SELECT id, username, access_token, user_id FROM accounts WHERE id = ?').get(accountId);
                        if (!account || !account.user_id) {
                            console.log("[FOLLOWED INDEXER] Account ".concat(accountId, " not found or no user_id"));
                            return [2 /*return*/];
                        }
                        console.log("[FOLLOWED INDEXER] Indexing followed channels for: ".concat(account.username));
                        follows = [];
                        pagination = '';
                        _b.label = 1;
                    case 1: return [4 /*yield*/, (0, node_fetch_1.default)("https://api.twitch.tv/helix/channels/followed?user_id=".concat(account.user_id, "&first=100&").concat(pagination), {
                            headers: {
                                'Client-Id': this.clientId,
                                'Authorization': "Bearer ".concat(account.access_token)
                            }
                        })];
                    case 2:
                        response = _b.sent();
                        if (!response.ok) {
                            throw new Error("Failed to fetch follows: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _b.sent();
                        follows = follows.concat(data.data || []);
                        pagination = ((_a = data.pagination) === null || _a === void 0 ? void 0 : _a.cursor) ? "after=".concat(data.pagination.cursor) : '';
                        _b.label = 4;
                    case 4:
                        if (pagination) return [3 /*break*/, 1];
                        _b.label = 5;
                    case 5:
                        console.log("[FOLLOWED INDEXER] Found ".concat(follows.length, " followed channels"));
                        added = 0;
                        for (_i = 0, follows_1 = follows; _i < follows_1.length; _i++) {
                            channel = follows_1[_i];
                            try {
                                existing = this.db.prepare('SELECT id FROM followed_channels WHERE account_id = ? AND streamer = ?').get(accountId, channel.broadcaster_name);
                                if (!existing) {
                                    this.db.prepare("\n              INSERT INTO followed_channels (account_id, streamer, streamer_id, game_name, status, points, viewer_count)\n              VALUES (?, ?, ?, ?, ?, ?, ?)\n            ").run(accountId, channel.broadcaster_name, channel.broadcaster_id, channel.game_name || 'Unknown', channel.is_live ? 'favorite' : null, 0, 0);
                                    added++;
                                }
                            }
                            catch (err) {
                                console.error('[FOLLOWED INDEXER] Failed to save channel:', err);
                            }
                        }
                        this.logActivity(accountId, 'info', "Indexed ".concat(follows.length, " channels, added ").concat(added, " new"));
                        console.log("[FOLLOWED INDEXER] Completed for ".concat(account.username, ": ").concat(added, " new channels"));
                        return [2 /*return*/, { total: follows.length, added: added }];
                    case 6:
                        error_1 = _b.sent();
                        console.error("[FOLLOWED INDEXER] Error indexing account ".concat(accountId, ":"), error_1);
                        this.logActivity(accountId, 'error', "Indexing failed: ".concat(error_1.message));
                        return [2 /*return*/, { total: 0, added: 0 }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    FollowedChannelsIndexer.prototype.getLiveStreams = function (channelName) {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, (0, node_fetch_1.default)("https://api.twitch.tv/helix/streams?user_login=".concat(channelName), {
                                headers: {
                                    'Client-Id': this.clientId,
                                    'Authorization': "Bearer ".concat(this.getAccessToken())
                                }
                            })];
                    case 1:
                        response = _b.sent();
                        if (!response.ok) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _b.sent();
                        return [2 /*return*/, ((_a = data.data) === null || _a === void 0 ? void 0 : _a[0]) || null];
                    case 3:
                        error_2 = _b.sent();
                        console.error('[FOLLOWED INDEXER] Error fetching stream:', error_2);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    FollowedChannelsIndexer.prototype.getAccessToken = function () {
        var account = this.db.prepare('SELECT accessToken FROM accounts WHERE status = ? LIMIT 1').get('farming');
        return (account === null || account === void 0 ? void 0 : account.access_token) || '';
    };
    FollowedChannelsIndexer.prototype.logActivity = function (accountId, type, message) {
        try {
            this.db.prepare('INSERT INTO logs (streamer_id, type, message, time) VALUES (?, ?, ?, datetime("now"))').run(accountId, type, message);
        }
        catch (err) {
            // Ignore log errors
        }
    };
    FollowedChannelsIndexer.prototype.start = function () {
        var _this = this;
        console.log('[FOLLOWED INDEXER] Starting periodic indexing (every 30 minutes)');
        this.indexingInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var farmingAccounts, _i, farmingAccounts_1, account;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        farmingAccounts = this.db.prepare('SELECT id FROM accounts WHERE status = ?').all('farming');
                        _i = 0, farmingAccounts_1 = farmingAccounts;
                        _a.label = 1;
                    case 1:
                        if (!(_i < farmingAccounts_1.length)) return [3 /*break*/, 4];
                        account = farmingAccounts_1[_i];
                        return [4 /*yield*/, this.indexAccount(account.id)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        }); }, 30 * 60 * 1000); // Every 30 minutes
    };
    FollowedChannelsIndexer.prototype.stop = function () {
        if (this.indexingInterval) {
            clearInterval(this.indexingInterval);
            this.indexingInterval = null;
        }
    };
    return FollowedChannelsIndexer;
}());
exports.default = FollowedChannelsIndexer;
