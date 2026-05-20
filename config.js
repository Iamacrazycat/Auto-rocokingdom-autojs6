var storage = storages.create("auto_roco_config");

module.exports = {
    // 轮询间隔，单位毫秒
    get POLL_INTERVAL_MS() { return storage.get("POLL_INTERVAL_MS", 3000); },

    // 按键冷却时间，单位毫秒
    get TRIGGER_COOLDOWN_MS() { return storage.get("TRIGGER_COOLDOWN_MS", 1000); },

    // 智能模式：紫底 HSV 范围 (H: 0-180, S: 0-255, V: 0-255)
    PURPLE_LOWER_HSV: [125, 40, 40],
    PURPLE_UPPER_HSV: [160, 255, 255],
    SMART_MODE_PURPLE_RATIO_THRESHOLD: 0.05,

    // 模板匹配通用阈值
    get TEMPLATE_MATCH_THRESHOLD() { return storage.get("TEMPLATE_MATCH_THRESHOLD", 0.7); },

    // HSV Marker过滤 (用于区分 capture 与 capture_abandon)
    MARKER_COLOR: "#b75755",
    MARKER_HUE_TOL: 8,
    MARKER_SAT_TOL: 70,
    MARKER_VAL_TOL: 70,
    MARKER_SCORE_THRESHOLD: 0.6,
    MARKER_MAX_EXTRA_PIXELS: 30,

    // escape_yes 模板匹配阈值（特例）
    get ESCAPE_YES_THRESHOLD() { return storage.get("ESCAPE_YES_THRESHOLD", 0.42); },

    // 模板图片存放路径
    TEMPLATE_DIR: "templates/",

    // 参考分辨率（用于模板缩放）
    get REF_WIDTH() { return storage.get("REF_WIDTH", 2772); },
    get REF_HEIGHT() { return storage.get("REF_HEIGHT", 1280); },

    // 攻击模式参数
    get CUSTOM_ATTACK_X() { return storage.get("CUSTOM_ATTACK_X", 0); },
    get CUSTOM_ATTACK_Y() { return storage.get("CUSTOM_ATTACK_Y", 0); },
    // 0: 聚能, 1: 重复攻击
    get CUSTOM_SUBSEQUENT_ACTION() { return storage.get("CUSTOM_SUBSEQUENT_ACTION", 0); },
    // 当可捕捉（变为无效战斗图标）时停止攻击并转为聚能
    get CUSTOM_STOP_WHEN_CATCHABLE() { return storage.get("CUSTOM_STOP_WHEN_CATCHABLE", true); }
};
