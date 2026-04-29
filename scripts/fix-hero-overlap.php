<?php
require_once dirname(__FILE__) . '/wp-load.php';

// The hero section on each cadeau subpage has an image container (422px)
// directly followed by the iframe section, causing visual overlap.
// Fix: add padding-bottom to the outer hero section so the next section
// starts cleanly below the image.

$pages = [1052, 1053, 1051];
$results = [];

// Each page has a different hero section ID — find it by looking for the
// section that DIRECTLY PRECEDES the iframe section at the top level.
function fix_hero_padding(&$decoded, &$fixed) {
  $iframe_section_index = null;

  // Find the index of the section that contains the iframe
  foreach ($decoded as $i => $el) {
    if (contains_iframe($el)) {
      $iframe_section_index = $i;
      break;
    }
  }

  if ($iframe_section_index === null || $iframe_section_index === 0) return;

  // The hero section is the one just before the iframe section
  $hero_index = $iframe_section_index - 1;
  $decoded[$hero_index]['settings']['padding'] = [
    'top'    => '60',
    'right'  => '0',
    'bottom' => '60',
    'left'   => '0',
    'unit'   => 'px',
    'isLinked' => false,
  ];
  $fixed = true;
}

function contains_iframe($el) {
  $wt = $el['widgetType'] ?? '';
  if ($wt === 'html') {
    return strpos($el['settings']['html'] ?? '', 'gravida-booking') !== false;
  }
  foreach ($el['elements'] ?? [] as $child) {
    if (contains_iframe($child)) return true;
  }
  return false;
}

foreach ($pages as $post_id) {
  $data    = get_post_meta($post_id, '_elementor_data', true);
  $decoded = json_decode($data, true);
  if (!is_array($decoded)) {
    $results[] = "Page $post_id: JSON decode mislukt";
    continue;
  }

  $fixed = false;
  fix_hero_padding($decoded, $fixed);

  if (!$fixed) {
    $results[] = "Page $post_id: hero sectie niet gevonden";
    continue;
  }

  update_post_meta($post_id, '_elementor_data', wp_slash(json_encode($decoded)));
  $results[] = "Page $post_id: padding hersteld OK";
}

if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
}

@unlink(__FILE__);
echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
