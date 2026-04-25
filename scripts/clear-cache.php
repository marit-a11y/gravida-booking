<?php
require_once dirname(__FILE__) . '/wp-load.php';

$results = [];

// Clear Elementor cache
if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
  \Elementor\Plugin::$instance->files_manager->clear_cache();
  $results[] = 'Elementor cache geleegd';
}

// Purge LiteSpeed cache if available
if (class_exists('LiteSpeed_Cache_API')) {
  LiteSpeed_Cache_API::purge_all();
  $results[] = 'LiteSpeed cache geleegd';
} elseif (function_exists('litespeed_purge_all')) {
  litespeed_purge_all();
  $results[] = 'LiteSpeed cache geleegd (functie)';
} else {
  $results[] = 'LiteSpeed class niet gevonden — cache handmatig leegmaken in wp-admin';
}

// Also trigger WordPress rewrite flush
flush_rewrite_rules(false);

@unlink(__FILE__);

echo "<pre>\n";
foreach ($results as $r) echo htmlspecialchars($r) . "\n";
echo "</pre><p>Klaar.</p>";
