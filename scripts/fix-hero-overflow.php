<?php
require_once dirname(__FILE__) . '/wp-load.php';

// The hero image container e594ddc5 has custom height + bg image causing overlap.
// Fix: remove absolute positioning, ensure hero section doesn't overflow.
// Also add top margin to iframe section so it sits cleanly below.

$pages = [1052, 1053, 1051];
$results = [];

function fix_overlap(&$elements, &$fixed) {
  foreach ($elements as &$el) {
    $id = $el['id'] ?? '';
    $s  = &$el['settings'];

    // Fix the image container causing overflow (e594ddc5 on page 1052, similar on others)
    // Identify by: has bg_image + h=custom, is inside the hero section
    if (!empty($s['background_image']['url']) && isset($s['height']) && $s['height'] === 'custom') {
      // Remove absolute/fixed positioning if set
      if (isset($s['position'])) unset($s['position']);
      if (isset($s['_position'])) unset($s['_position']);
      // Don't let it overflow
      $s['overflow'] = 'hidden';
      // Keep the height but make sure it's reasonable
      // If custom height value is excessively large, cap it
      if (isset($s['custom_height'])) {
        $val = (int)($s['custom_height']['size'] ?? 0);
        if ($val > 600) {
          $s['custom_height'] = ['size' => 500, 'unit' => 'px'];
        }
      }
      $fixed = true;
    }

    // Fix the iframe section: ensure no negative top margin
    if (!empty($el['elements'])) {
      foreach ($el['elements'] as $child) {
        foreach ($child['elements'] ?? [] as $gc) {
          if (($gc['widgetType'] ?? '') === 'html') {
            $html = $gc['settings']['html'] ?? '';
            if (strpos($html, 'gravida-booking') !== false) {
              // This is the iframe section — clear any negative margin
              unset($s['margin']);
              unset($s['_margin']);
              $fixed = true;
            }
          }
        }
      }
    }

    if (!empty($el['elements'])) {
      fix_overlap($el['elements'], $fixed);
    }
  }
}

foreach ($pages as $post_id) {
  $data    = get_post_meta($post_id, '_elementor_data', true);
  $decoded = json_decode($data, true);
  if (!is_array($decoded)) {
    $results[] = "Page $post_id: JSON decode mislukt";
    continue;
  }

  $fixed = false;
  fix_overlap($decoded, $fixed);

  if (!$fixed) {
    $results[] = "Page $post_id: niets gevonden om te fixen";
    continue;
  }

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));
  $results[] = "Page $post_id: overlap gecorrigeerd OK";
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
