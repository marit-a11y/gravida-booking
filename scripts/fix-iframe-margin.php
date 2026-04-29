<?php
require_once dirname(__FILE__) . '/wp-load.php';

// Fix overlap on all 3 cadeau subpages:
// Find the section/container that holds the iframe widget
// and remove any negative top margin.

$pages = [1052, 1053, 1051];
$results = [];

function fix_iframe_section_margin(&$elements, &$fixed) {
  foreach ($elements as &$el) {
    $elType = isset($el['elType']) ? $el['elType'] : '';
    $settings = isset($el['settings']) ? $el['settings'] : [];

    // Check if this element (or any direct child) contains the iframe widget
    $has_iframe = false;
    if (!empty($el['elements'])) {
      foreach ($el['elements'] as $child) {
        // Check direct children
        if ((isset($child['widgetType']) && $child['widgetType'] === 'html') ||
            (isset($child['elType']) && $child['elType'] !== 'widget')) {
          // Check grandchildren
          if (!empty($child['elements'])) {
            foreach ($child['elements'] as $grandchild) {
              if (isset($grandchild['widgetType']) && $grandchild['widgetType'] === 'html') {
                $html = isset($grandchild['settings']['html']) ? $grandchild['settings']['html'] : '';
                if (strpos($html, 'gravida-booking') !== false) {
                  $has_iframe = true;
                }
              }
            }
          }
          // Direct child is html widget
          if (isset($child['widgetType']) && $child['widgetType'] === 'html') {
            $html = isset($child['settings']['html']) ? $child['settings']['html'] : '';
            if (strpos($html, 'gravida-booking') !== false) {
              $has_iframe = true;
            }
          }
        }
      }
    }

    if ($has_iframe) {
      // Remove negative margins, ensure positive top padding
      $el['settings']['margin'] = [
        'top'    => '0',
        'right'  => '0',
        'bottom' => '0',
        'left'   => '0',
        'unit'   => 'px',
        'isLinked' => false,
      ];
      $el['settings']['margin_tablet'] = [
        'top'    => '0',
        'right'  => '0',
        'bottom' => '0',
        'left'   => '0',
        'unit'   => 'px',
        'isLinked' => false,
      ];
      // Add top padding so it doesn't sit flush against image
      $el['settings']['padding'] = [
        'top'    => '40',
        'right'  => '20',
        'bottom' => '40',
        'left'   => '20',
        'unit'   => 'px',
        'isLinked' => false,
      ];
      $fixed = true;
    }

    if (!empty($el['elements'])) {
      fix_iframe_section_margin($el['elements'], $fixed);
    }
  }
}

foreach ($pages as $post_id) {
  $data = get_post_meta($post_id, '_elementor_data', true);
  $decoded = json_decode($data, true);
  if (!is_array($decoded)) {
    $results[] = "Page $post_id: JSON decode mislukt";
    continue;
  }

  $fixed = false;
  fix_iframe_section_margin($decoded, $fixed);

  if (!$fixed) {
    $results[] = "Page $post_id: iframe sectie niet gevonden";
    continue;
  }

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));
  $results[] = "Page $post_id: marge gereset OK";
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
