import { Client } from 'pg';
import pgFormat from 'pg-format';

export default async function seed(db: Client) {
  try {
    await loadPrepaidCardColorSchemes(db);
    await loadPrepaidCardPatterns(db);
  } catch (e) {
    console.error(e);
  }
}

async function loadPrepaidCardColorSchemes(db: Client) {
  let colorSchemeQueryText = `INSERT INTO prepaid_card_color_schemes(
    id, background, pattern_color, text_color, description
  )
  VALUES %L ON CONFLICT (id) DO UPDATE SET
    background = excluded.background,
    pattern_color = excluded.pattern_color,
    text_color = excluded.text_color,
    description = excluded.description;
`;
  let colorSchemeRows = [
    ['7CEE903B-E342-4BD7-A3DA-EB3AB2DC078D', '#00ebe5', 'white', 'black', 'Solid Light Blue'],
    ['232B7E38-1F9A-4599-A870-8F7A9BCBA6E4', '#37eb77', 'white', 'black', 'Solid Lime Green'],
    ['5ED643F8-A8BB-4748-BCD6-98E850FBA505', '#ac00ff', 'white', 'white', 'Solid Purple'],
    ['6997F87C-D1EE-45F8-8A49-D19A9D5FAD73', '#efefef', 'white', 'black', 'Solid Light Grey'],
    ['16B83804-1FF9-4AA2-B670-472919EFF8C3', '#393642', 'white', 'white', 'Solid Dark'],
    ['7B05C4EA-6BAA-471F-9B49-7AC10ADF2F9A', '#c3fc33', 'white', 'black', 'Solid Yellow Green'],
    [
      '74A8AAC0-4EDA-4146-B48E-A6FBF2DA9472',
      'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
      'white',
      'white',
      'Red to Purple Gradient',
    ],
    [
      '92BE8DCE-D862-44CA-A55A-43758564854B',
      'linear-gradient(139.27deg, #03c4bf 16%, #ac00ff 100%)',
      'white',
      'white',
      'Blue to Purple Gradient',
    ],
    [
      '5C2276BE-FDDD-49DD-9693-D7B3B3E91A1F',
      'linear-gradient(139.27deg, #c3fc33 16%, #0069f9 100%)',
      'white',
      'black',
      'Green to Blue Gradient',
    ],
    [
      '2099CE49-39EB-4353-A743-D7B310FD9D22',
      'linear-gradient(139.27deg, #ac00ff 16%, #ffd800 100%)',
      'white',
      'white',
      'Purple to Orange Gradient',
    ],
    ['39A4C689-C130-4A84-BF81-0DC0BB99D846', 'transparent', 'black', 'black', 'Transparent'],
  ];
  let sql = pgFormat(colorSchemeQueryText, colorSchemeRows);
  console.log(sql);
  let result = await db.query(sql);
  console.log(`Upserted ${result.rowCount} prepaid_card_color_schemes rows`);
}

async function loadPrepaidCardPatterns(db: Client) {
  let patternsQueryText = `INSERT INTO prepaid_card_patterns(
    id, pattern_url, description
  )
  VALUES %L ON CONFLICT (id) DO UPDATE SET
    pattern_url = excluded.pattern_url,
    description = excluded.description;`;
  let patternRows = [
    ['3B8B436B-A99E-4346-AB20-3BA5F9963321', null, 'None'],
    ['451ed569-fb6f-4b61-8b80-e10e25ea7fa2', '/images/prepaid-card-customizations/pattern-1.svg', ''],
    ['08086b26-0b2d-43aa-a7cc-dffc7ffc45eb', '/images/prepaid-card-customizations/pattern-2.svg', ''],
    ['aec7322a-84e2-4969-a03d-022460705fee', '/images/prepaid-card-customizations/pattern-3.svg', ''],
    ['78c26684-4e70-4152-996b-f453934d2485', '/images/prepaid-card-customizations/pattern-4.svg', ''],
  ];
  let sql = pgFormat(patternsQueryText, patternRows);
  console.log(sql);
  let result = await db.query(sql);
  console.log(`Upserted ${result.rowCount} prepaid_card_patterns rows`);
}
