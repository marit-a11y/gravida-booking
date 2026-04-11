<?php
$wpLoad = dirname(__FILE__);
for ($i = 0; $i < 8; $i++) {
    if (file_exists($wpLoad . '/wp-load.php')) break;
    $wpLoad = dirname($wpLoad);
}
require $wpLoad . '/wp-load.php';

function gravida_extract_ids($els, $depth = 0) {
    $result = [];
    foreach ($els as $el) {
        $line = str_repeat('  ', $depth)
            . ($el['id'] ?? '?')
            . ' [' . ($el['elType'] ?? '') . '] '
            . ($el['widgetType'] ?? '')
            . (isset($el['settings']['title'])  ? ' | ' . substr(strip_tags($el['settings']['title']), 0, 50)  : '')
            . (isset($el['settings']['editor']) ? ' | ' . substr(strip_tags($el['settings']['editor']), 0, 70) : '');
        $result[] = $line;
        if (!empty($el['elements'])) {
            $result = array_merge($result, gravida_extract_ids($el['elements'], $depth + 1));
        }
    }
    return $result;
}

$pages = [
    'limburg'                       => '3d-zwangerschapsscan-aan-huis-in-limburg',
    'noord-holland-flevoland'       => '3d-zwangerschapsscan-aan-huis-noord-holland-flevoland',
    'utrecht-gelderland-overijssel' => 'zwangerschapsbeeld-utrecht-gelderland-overijssel',
    'zuid-holland'                  => '3d-zwangerschapsscan-aan-huis-in-zuid-holland',
];

$out = [];
foreach ($pages as $key => $slug) {
    $page = get_page_by_path($slug, OBJECT, 'page');
    if (!$page) { $out[$key] = 'NOT FOUND: ' . $slug; continue; }
    $data = json_decode(get_post_meta($page->ID, '_elementor_data', true), true);
    $out[$key] = [
        'id'        => $page->ID,
        'title'     => $page->post_title,
        'structure' => gravida_extract_ids($data ?: []),
    ];
}

header('Content-Type: application/json');
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
