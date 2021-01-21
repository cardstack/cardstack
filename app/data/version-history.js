import oldAlbumArt from "@cardstack/boxel/images/media-registry/old-album-art.png";
import autumnLeavesCover from "@cardstack/boxel/images/media-registry/covers/Autumn-Leaves.jpg";
import autumnLeavesThumb from "@cardstack/boxel/images/media-registry/covers/thumb/Autumn-Leaves.jpg";
import autumnLeavesMedium from "@cardstack/boxel/images/media-registry/covers/medium/Autumn-Leaves.jpg";
import autumnLeavesLarge from "@cardstack/boxel/images/media-registry/covers/large/Autumn-Leaves.jpg";

import {
  PIA_MIDINA,
  FRANCESCO_MIDINA,
  JOEL_KAPLAN,
  MARIAH_SOLIS,
  IAN_ADAMS,
  JENNY_SPARKS,
  SOPHIA_LANAGAN,
  HELEN_GELLAR,
  ARTHUR_DOYLE
} from './profiles';

const MUSICAL_WORK = {
  "type": "card",
  "component": "cards/musical-work-embedded",
  "value": {
    "artist": "Pia Midina",
    "artist_id": "pia-midina",
    "composer": "Miles Ponia",
    "composer_id": "miles-ponia",
    "copyright_notice": "© 2020 RealTunes Publishing",
    "iswc": "T-030248890-1",
    "publisher": "RealTunes Publishing",
    "title": "The leaves are changing color",
    "type": "musical-work",
    "verifi_id": "0x1b8932b7c27d6ca5d8bd3201fa7c28071221165dc2f1b4528c22e2809d8923ba",
    "version_type": "Original work"
  }
};

export default [
  {
    "id": "the-leaves-are-changing-color",
    "title": "The Leaves Are Changing Color",
    "versions": [
      {
        "id": 1,
        "record_id": "the-leaves-are-changing-color",
        "published": "2020-01-16T13:30:00",
        "description": "Recorded",
        "card_model": {
          "id": "the-leaves-are-changing-color",
          "title": "Leaves Are Changing Color",
          "artist": "Pia Midina",
          "verifi_id": "0x9b2138a6c17e6da2d9cd3303fe7b26079231184ac2f1b6537a11e2301b74ca26",
          "fields": {
            "title": "Leaves Are Changing Color",
            "version_type": "Recording",
            "artists": {
              "type": "collection",
              "component": "cards/artist",
              "value": [ PIA_MIDINA ]
            },
            "genre": ["Alternative", "Dream Pop"],
            "album_art": null,
            "label": "Bunny Records",
            "copyright_notice": "℗ 2020 Bunny Records",
            "parental_advisory": "No",
            "musical_work": MUSICAL_WORK,
            "isrc": "US-S1Z-20-05001",
            "year": "2020",
            "length": "3:23"
          }
        }
      },
      {
        "id": 2,
        "published": "2020-02-17T05:15:00",
        "record_id": "the-leaves-are-changing-color",
        "description": "2020 release confirmed",
        "card_model": {
          "id": "the-leaves-are-changing-color",
          "title": "Leaves Are Changing Color",
          "artist": "Pia Midina",
          "verifi_id": "0x9b2138a6c17e6da2d9cd3303fe7b26079231184ac2f1b6537a11e2301b74ca26",
          "fields": {
            "title": "Leaves Are Changing Color",
            "version_type": "Recording",
            "artists": {
              "type": "collection",
              "component": "cards/artist",
              "value": [
                PIA_MIDINA,
                JENNY_SPARKS
              ]
            },
            "genre": ["Alternative", "Dream Pop"],
            "album_art": null,
            "release_date": "2020",
            "label": "Bunny Records",
            "copyright_notice": "℗ 2020 Bunny Records",
            "parental_advisory": "No",
            "musical_work": MUSICAL_WORK,
            "isrc": "US-S1Z-20-05001",
            "year": "2020",
            "length": "3:23"
          }
        }
      },
      {
        "id": 3,
        "published": "2020-02-21T11:14:00",
        "record_id": "the-leaves-are-changing-color",
        "description": "Updated based on credible rumor",
        "card_model": {
          "id": "the-leaves-are-changing-color",
          "title": "Fall Is Back",
          "artist": "Pia Midina",
          "verifi_id": "0x9b2138a6c17e6da2d9cd3303fe7b26079231184ac2f1b6537a11e2301b74ca26",
          "cover_art": oldAlbumArt,
          "cover_art_thumb": oldAlbumArt,
          "cover_art_medium": oldAlbumArt,
          "cover_art_large": oldAlbumArt,
          "fields": {
            "title": "Fall Is Back",
            "version_type": "Recording",
            "artists": {
              "type": "collection",
              "component": "cards/artist",
              "value": [
                PIA_MIDINA,
                JENNY_SPARKS,
                ARTHUR_DOYLE
              ]
            },
            "genre": ["Alternative", "Dream Pop"],
            "album_art": oldAlbumArt,
            "release_date": "2020",
            "label": "Bunny Records",
            "copyright_notice": "℗ 2020 Bunny Records",
            "parental_advisory": "No",
            "musical_work": MUSICAL_WORK,
            "isrc": "US-S1Z-20-05001",
            "year": "2020",
            "length": "3:23"
          }
        }
      },
      {
        "id": 4,
        "published": "2020-02-25T13:06:00",
        "record_id": "the-leaves-are-changing-color",
        "description": "Official announcement",
        "card_model": {
          "id": "the-leaves-are-changing-color",
          "title": "The Leaves Are Changing Color",
          "artist": "Pia Midina",
          "verifi_id": "0x9b2138a6c17e6da2d9cd3303fe7b26079231184ac2f1b6537a11e2301b74ca26",
          "cover_art": autumnLeavesCover,
          "cover_art_thumb": autumnLeavesThumb,
          "cover_art_medium": autumnLeavesMedium,
          "cover_art_large": autumnLeavesLarge,
          "fields": {
            "title": "The Leaves Are Changing Color",
            "version_type": "Recording",
            "artists": {
              "type": "collection",
              "component": "cards/artist",
              "value": [
                PIA_MIDINA,
                JENNY_SPARKS
              ]
            },
            "genre": ["Alternative", "Dream Pop"],
            "album_art": autumnLeavesMedium,
            "release_date": "2020",
            "label": "Bunny Records",
            "copyright_notice": "℗ 2020 Bunny Records",
            "parental_advisory": "No",
            "musical_work": MUSICAL_WORK,
            "isrc": "US-S1Z-20-05001",
            "year": "2020",
            "length": "3:23"
          }
        }
      },
      {
        "id": 5,
        "published": "2020-04-16T10:22:00",
        "record_id": "the-leaves-are-changing-color",
        "description": "Retail stores’ sales figures released",
        "card_model": {
          "id": "the-leaves-are-changing-color",
          "title": "The Leaves Are Changing Color",
          "artist": "Pia Midina",
          "verifi_id": "0x9b2138a6c17e6da2d9cd3303fe7b26079231184ac2f1b6537a11e2301b74ca26",
          "cover_art": autumnLeavesCover,
          "cover_art_thumb": autumnLeavesThumb,
          "cover_art_medium": autumnLeavesMedium,
          "cover_art_large": autumnLeavesLarge,
          "fields": {
            "title": "The Leaves Are Changing Color",
            "version_type": "Recording",
            "artists": {
              "type": "collection",
              "component": "cards/artist",
              "value": [
                PIA_MIDINA,
                JENNY_SPARKS,
                SOPHIA_LANAGAN,
                HELEN_GELLAR
              ]
            },
            "genre": ["Alternative", "Dream Pop"],
            "sales": {
              "type": "card",
              "value": {
                "type": "revenue-data",
                "fields": [
                  {
                    "title": "United States",
                    "value": "$7k"
                  },
                  {
                    "title": "International",
                    "value": "$11k"
                  },
                  {
                    "title": "Total",
                    "value": "$18k"
                  }
                ]
              }
            },
            "album_art": autumnLeavesMedium,
            "release_date": {
              "type": "collection",
              "value": [
                {
                  "type": "schedule",
                  "id": "release_date",
                  "fields": [{
                    "title": "Release Date",
                    "value": "March 2, 2020"
                  }]
                }
              ]
            },
            "label": "Bunny Records",
            "copyright_notice": "℗ 2020 Bunny Records",
            "parental_advisory": "No",
            "musical_work": MUSICAL_WORK,
            "isrc": "US-S1Z-20-05001",
            "year": "2020",
            "length": "3:23"
          }
        }
      },
      {
        "id": 6,
        "published": "2020-05-04T19:32:00",
        "record_id": "the-leaves-are-changing-color",
        "description": "Digital download available worldwide",
        "card_model": {
          "id": "the-leaves-are-changing-color",
          "title": "The Leaves Are Changing Color",
          "artist": "Pia Midina",
          "verifi_id": "0x9b2138a6c17e6da2d9cd3303fe7b26079231184ac2f1b6537a11e2301b74ca26",
          "cover_art": autumnLeavesCover,
          "cover_art_thumb": autumnLeavesThumb,
          "cover_art_medium": autumnLeavesMedium,
          "cover_art_large": autumnLeavesLarge,
          "fields": {
            "title": "The Leaves Are Changing Color",
            "alternate_title": "Colorful Leaves",
            "version_type": "Recording",
            "artists": {
              "type": "collection",
              "component": "cards/artist",
              "value": [
                PIA_MIDINA,
                FRANCESCO_MIDINA,
                JOEL_KAPLAN,
                MARIAH_SOLIS,
                IAN_ADAMS,
                JENNY_SPARKS,
                SOPHIA_LANAGAN,
                HELEN_GELLAR
              ]
            },
            "genre": ["Alternative", "Dream Pop"],
            "sales": {
              "type": "card",
              "value": {
                "type": "revenue-data",
                "fields": [
                  {
                    "title": "United States",
                    "value": "$9k"
                  },
                  {
                    "title": "International",
                    "value": "$13k"
                  },
                  {
                    "title": "Total",
                    "value": "$22k"
                  }
                ]
              }
            },
            "album_art": autumnLeavesMedium,
            "release_date": {
              "type": "collection",
              "value": [
                {
                  "type": "schedule",
                  "id": "release_date",
                  "fields": [{
                    "title": "Release Date",
                    "value": "March 2, 2020"
                  }]
                },
                {
                  "type": "schedule",
                  "id": "digital_download",
                  "fields": [{
                    "title": "Digital Download",
                    "value": "May 4, 2020"
                  }]
                }
              ]
            },
            "label": "Bunny Records",
            "copyright_notice": "℗ 2020 Bunny Records",
            "parental_advisory": "No",
            "musical_work": MUSICAL_WORK,
            "isrc": "US-S1Z-20-05001",
            "year": "2020",
            "length": "3:23"
          }
        }
      }
    ]
  }
]
