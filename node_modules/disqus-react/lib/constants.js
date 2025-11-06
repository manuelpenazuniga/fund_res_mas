"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.THREAD_ID = exports.RECOMMENDATIONS_SCRIPT_ID = exports.RECOMMENDATIONS_ID = exports.EMBED_SCRIPT_ID = exports.COMMENT_EMBED_WIDTH = exports.COMMENT_EMBED_HEIGHT = exports.COMMENT_COUNT_SCRIPT_ID = exports.COMMENT_COUNT_CLASS = exports.CALLBACKS = void 0;
var THREAD_ID = exports.THREAD_ID = 'disqus_thread';
var EMBED_SCRIPT_ID = exports.EMBED_SCRIPT_ID = 'dsq-embed-scr';
var COMMENT_COUNT_CLASS = exports.COMMENT_COUNT_CLASS = 'disqus-comment-count';
var COMMENT_COUNT_SCRIPT_ID = exports.COMMENT_COUNT_SCRIPT_ID = 'dsq-count-scr';
var COMMENT_EMBED_WIDTH = exports.COMMENT_EMBED_WIDTH = 420;
var COMMENT_EMBED_HEIGHT = exports.COMMENT_EMBED_HEIGHT = 320;
var RECOMMENDATIONS_ID = exports.RECOMMENDATIONS_ID = 'disqus_recommendations';
var RECOMMENDATIONS_SCRIPT_ID = exports.RECOMMENDATIONS_SCRIPT_ID = 'dsq-recs-scr';
var CALLBACKS = exports.CALLBACKS = ['preData', 'preInit', 'onInit', 'onReady', 'afterRender', 'preReset', 'onIdentify', 'beforeComment', 'onNewComment', 'onPaginate'];