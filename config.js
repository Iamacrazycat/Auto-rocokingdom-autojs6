module.exports = {
    // 匹配阈值
    MATCH_THRESHOLD: 0.50,
    
    // 轮询间隔，单位毫秒 (根据性能可调整)
    POLL_INTERVAL_MS: 3000,
    
    // 按键冷却/点击等待时间，单位毫秒
    TRIGGER_COOLDOWN_MS: 1000,
    
    // 智能模式：紫底 HSV 范围 (H: 0-180, S: 0-255, V: 0-255)
    PURPLE_LOWER_HSV: [125, 40, 40],
    PURPLE_UPPER_HSV: [160, 255, 255],
    SMART_MODE_PURPLE_RATIO_THRESHOLD: 0.05,
    
    // 状态判定连击要求
    REQUIRED_HITS: 1,
    RELEASE_MISSES: 2,
    
    // 模板图片存放路径
    TEMPLATE_DIR: "templates/",
    
    // 参考分辨率宽度 (如果你的模板是在电脑 2560x1600 环境下截得，写 2560)
    // 脚本会自动基于此基准和当前手机的分辨率算出缩放比
    REF_WIDTH: 2560,

    // 可配置使用的引擎： 'TEMPLATE' (缩放版模板匹配，无需 OCR 和 SIFT)
    DETECT_ENGINE: 'TEMPLATE',
};
