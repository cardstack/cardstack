#!/usr/bin/env ruby

javascript = IO.read 'all_tracks_combined.js'
cover_art_file_names = javascript
  .scan(/"cover_art": "\/boxel\/media-registry\/covers\/(.+)\.jpg"/)
  .map{|match| match[0] }
  .sort
  .uniq

imports = cover_art_file_names.map do |filename|
  modulename_prefix = filename.gsub('-', '')
"import #{modulename_prefix}Cover from '@cardstack/boxel/images/media-registry/covers/#{filename}.jpg';
import #{modulename_prefix}Thumb from '@cardstack/boxel/images/media-registry/covers/thumb/#{filename}.jpg';
import #{modulename_prefix}Medium from '@cardstack/boxel/images/media-registry/covers/medium/#{filename}.jpg';
import #{modulename_prefix}Large from '@cardstack/boxel/images/media-registry/covers/large/#{filename}.jpg';
"
end
# insert imports at top
javascript.gsub!(/(export default \[)/, imports.join("\n") + "\n\/\/ All covers reexpored at bottom of file\n" + '\1')

# replace usages with modulenames
javascript.gsub!(/"cover_art": "\/boxel\/media-registry\/covers\/(.+)\.jpg"/) {
  filename = Regexp.last_match[1]
  modulename_prefix = filename.gsub('-','')
  %Q|"cover_art": #{modulename_prefix}Cover|
}
['thumb', 'medium', 'large'].each do |size|
  javascript.gsub!(/"cover_art_#{size}": "\/boxel\/media-registry\/covers\/#{size}\/(.+)\.jpg"/) {
    filename = Regexp.last_match[1]
    modulename_prefix = filename.gsub('-','')
    %Q|"cover_art_#{size}": #{modulename_prefix}#{size.capitalize}|
  }
end

# generate exports
modules = cover_art_file_names.map {|filename| filename.gsub('-', '') }.map{|modulename|
  ["#{modulename}Cover", "#{modulename}Thumb", "#{modulename}Medium", "#{modulename}Large"]
}.flatten
javascript << "\n\nexport { #{modules.join(", ")} };"

# write out the file
File.open("all_tracks_combined.js", 'w') do |file|
  file.write(javascript)
end
