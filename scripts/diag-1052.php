<?php
require_once dirname(__FILE__) . '/wp-load.php';

$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

// Walk tree, print all widgets with their type and relevant content
function dump_widgets($elements, $depth = 0) {
  foreach ($elements as $el) {
    $wt = isset($el['widgetType']) ? $el['widgetType'] : '-';
    $et = isset($el['elType']) ? $el['elType'] : '-';
    $id = isset($el['id']) ? $el['id'] : '?';
    $pad = str_repeat('  ', $depth);

    if ($wt !== '-') {
      // Show widget content
      $preview = '';
      if ($wt === 'shortcode') {
        $preview = isset($el['settings']['shortcode']) ? $el['settings']['shortcode'] : '';
      } elseif ($wt === 'html') {
        $preview = isset($el['settings']['html']) ? substr($el['settings']['html'], 0, 100) : '';
      } elseif ($wt === 'text-editor') {
        $preview = isset($el['settings']['editor']) ? substr(strip_tags($el['settings']['editor']), 0, 80) : '';
      } elseif ($wt === 'heading') {
        $preview = isset($el['settings']['title']) ? substr($el['settings']['title'], 0, 80) : '';
      }
      echo $pad . "[$id] widget:$wt  » " . htmlspecialchars(substr($preview, 0, 120)) . "\n";
    }

    if (!empty($el['elements'])) {
      dump_widgets($el['elements'], $depth + 1);
    }
  }
}

echo "<pre>\n";
dump_widgets($decoded);
echo "</pre>\n";

@unlink(__FILE__);
echo "<p>Script verwijderd.</p>";
