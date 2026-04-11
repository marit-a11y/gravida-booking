<?php
$wpLoad = dirname(__FILE__);
for ($i = 0; $i < 8; $i++) {
    if (file_exists($wpLoad . '/wp-load.php')) break;
    $wpLoad = dirname($wpLoad);
}
require $wpLoad . '/wp-load.php';

// ─── Helper: recursively find a container/widget by ID and run a callback ────
function gravida_walk(&$elements, $targetId, $callback, &$done) {
    foreach ($elements as &$el) {
        if ($done) return;
        if (($el['id'] ?? '') === $targetId) {
            $callback($el);
            $done = true;
            return;
        }
        if (!empty($el['elements'])) gravida_walk($el['elements'], $targetId, $callback, $done);
    }
    unset($el);
}

// ─── Helper: remove child widgets/containers with given IDs from a container ──
function gravida_remove_children(&$elements, $parentId, array $removeIds, &$done) {
    foreach ($elements as &$el) {
        if ($done) return;
        if (($el['id'] ?? '') === $parentId && isset($el['elements'])) {
            $el['elements'] = array_values(array_filter($el['elements'], fn($c) => !in_array($c['id'] ?? '', $removeIds)));
            $done = true;
            return;
        }
        if (!empty($el['elements'])) gravida_remove_children($el['elements'], $parentId, $removeIds, $done);
    }
    unset($el);
}

// ─── Helper: append a widget to a container ───────────────────────────────────
function gravida_append_to(&$elements, $containerId, $widget, &$done) {
    foreach ($elements as &$el) {
        if ($done) return;
        if (($el['id'] ?? '') === $containerId && isset($el['elements'])) {
            $el['elements'][] = $widget;
            $done = true;
            return;
        }
        if (!empty($el['elements'])) gravida_append_to($el['elements'], $containerId, $widget, $done);
    }
    unset($el);
}

// ─── Iframe widget builder ─────────────────────────────────────────────────────
function make_iframe($widgetId, $slug) {
    $src = "https://gravida-booking.vercel.app/boek/{$slug}";
    $ifrId = "gravida-booking-iframe-{$widgetId}";
    return [
        'id'         => $widgetId,
        'elType'     => 'widget',
        'settings'   => [
            'html' => '<div style="width:100%;overflow:hidden;">'
                    . "<iframe id=\"{$ifrId}\" src=\"{$src}\" style=\"width:100%;height:600px;border:none;display:block;transition:height .15s ease;\" scrolling=\"no\" loading=\"lazy\"></iframe>"
                    . '</div>'
                    . "<script>window.addEventListener(\"message\",function(e){var f=document.getElementById(\"{$ifrId}\");if(f&&e.data&&e.data.type===\"gravida-resize\"&&e.data.height){f.style.height=(e.data.height+32)+\"px\";}});</script>",
        ],
        'elements'   => [],
        'widgetType' => 'html',
    ];
}

// ─── Page definitions ──────────────────────────────────────────────────────────
$patches = [
    // Limburg (7715):
    //   • Container cd4381e has heading 668f309 + text-editor f1a9cc0 (Bookly+text)
    //   • Remove f1a9cc0, append iframe to cd4381e
    7715 => [
        'remove_children' => ['cd4381e', ['f1a9cc0']],
        'append_to'       => ['cd4381e', make_iframe('gravida-limburg', 'limburg')],
    ],

    // Noord-Holland & Flevoland (7551):
    //   • Container 0bf7a9e = Bookly, e028af9 = duplicate text — both inside 6d5410dc
    //   • Remove both containers from 6d5410dc, append iframe to cd4381e (the booking container)
    7551 => [
        'remove_children' => ['6d5410dc', ['0bf7a9e', 'e028af9']],
        'append_to'       => ['cd4381e', make_iframe('gravida-nhfl', 'noord-holland-flevoland')],
    ],

    // Utrecht, Gelderland & Overijssel (7582):
    //   • Container 5ea2728 = Bookly + duplicate — inside 79b1299e
    //   • Remove 5ea2728 from 79b1299e, append iframe to 1b33d13a
    7582 => [
        'remove_children' => ['79b1299e', ['5ea2728']],
        'append_to'       => ['1b33d13a', make_iframe('gravida-ugo', 'utrecht-gelderland-overijssel')],
    ],

    // Zuid-Holland (7616):
    //   • Container 6be1fcdc has heading + text-editor 6f92f14e (Bookly+text)
    //   • Remove 6f92f14e, append iframe to 6be1fcdc
    7616 => [
        'remove_children' => ['6be1fcdc', ['6f92f14e']],
        'append_to'       => ['6be1fcdc', make_iframe('gravida-zh', 'zuid-holland')],
    ],
];

$results = [];

foreach ($patches as $pageId => $ops) {
    $raw  = get_post_meta($pageId, '_elementor_data', true);
    $data = json_decode($raw, true);
    if (!$data) { $results[$pageId] = 'ERROR: JSON decode failed'; continue; }

    // 1. Remove children
    [$parentId, $removeIds] = $ops['remove_children'];
    $done = false;
    gravida_remove_children($data, $parentId, $removeIds, $done);
    $removed = $done ? implode(', ', $removeIds) : 'NOT FOUND';

    // 2. Append iframe widget
    [$appendTo, $widget] = $ops['append_to'];
    $done = false;
    gravida_append_to($data, $appendTo, $widget, $done);
    $appended = $done ? $widget['id'] : 'NOT FOUND';

    // Save
    update_post_meta($pageId, '_elementor_data', wp_slash(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
    $results[$pageId] = "removed: [{$removed}] | appended: {$appended}";
}

// Clear Elementor cache
if (class_exists('\Elementor\Plugin')) \Elementor\Plugin::$instance->files_manager->clear_cache();
if (function_exists('rocket_clean_domain'))  rocket_clean_domain();
if (class_exists('LiteSpeed\Purge'))         \LiteSpeed\Purge::purge_all();

echo "DONE\n";
foreach ($results as $id => $msg) echo "Page {$id}: {$msg}\n";
