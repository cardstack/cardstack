import { Client } from 'pg';
import pgFormat from 'pg-format';

export default async function seed(db: Client) {
  try {
    await loadPrepaidCardColorSchemes(db);
    await loadPrepaidCardPatterns(db);
    await loadNotificationTypes(db);
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
    ['4bb07815-7d4b-4312-8224-275d3c0d1af2', '#FFD800', 'white', 'black', 'School Bus Yellow'],
    ['12dec066-d361-4dad-a637-6a8e540e3940', '#37EB77', 'white', 'black', 'Malachite'],
    ['a1c8f96b-afcf-4d6a-8b6d-2d534fcf9b3a', '#C3FC33', 'white', 'black', 'Green Yellow'],
    ['168f673d-3a85-4a65-b7eb-397710e16395', '#00EBE5', 'white', 'black', 'Bright Turquoise'],
    ['ebb12dd0-becd-4242-9298-7c55056d9210', '#F5F5F5', 'white', 'black', 'White Smoke'],
    ['6f365f9b-594c-4137-bcf6-c3e35e47ed2f', '#FFEDDB', 'white', 'black', 'Papaya Whip'],
    ['7f2c64e6-383e-49f9-85f3-d1ec61b10afb', '#FFDBE5', 'white', 'black', 'Misty Rose'],
    ['2b651e70-6907-49e7-a378-2a49a740d8df', '#E9DBFF', 'white', 'black', 'Magnolia'],
    ['dbbd371d-7784-44b3-b438-2f8a286a016e', '#AC00FF', 'black', 'white', 'Electric Purple'],
    ['326af654-f95e-4f18-8eaf-10f224e9eb8b', '#393642', 'black', 'white', 'Black Marlin'],
    ['7693e60a-c47e-43cc-86b5-07b788c14fd0', '#0069F9', 'black', 'white', 'Navy Blue'],
    ['54a04f2f-43a0-478a-952e-e47cd284566d', '#FF5050', 'black', 'white', 'Sunset Orange'],
    [
      '9eb2f26f-53ea-407b-a114-8bd48c6081e7',
      'linear-gradient(139.27deg, #00EBE5 16%, #C3FC33 100%)',
      'white',
      'black',
      'Gradient: Bright Turquoise - Green Yellow',
    ],
    [
      '05af398d-ba94-4f8c-bee9-3f22b06b42e8',
      'linear-gradient(139.27deg, #FC8C8C 16%, #FFF5A7 100%)',
      'white',
      'black',
      'Gradient: Mona Lisa - Canary',
    ],
    [
      'ebfc37c0-7788-414d-856d-64892294eff8',
      'linear-gradient(139.27deg, #FF88D1 16%, #A3FFFF 100%)',
      'white',
      'black',
      'Gradient: Neon Pink - Columbia Blue',
    ],
    [
      '22f23e4e-7efc-441f-935f-e63ad230b615',
      'linear-gradient(139.27deg, #FFFFAA 16%, #B7FFFC 100%)',
      'white',
      'black',
      'Gradient: Canary - Light Cyan',
    ],
    [
      '28154a2e-c265-4f6f-9dbf-83fd3d34892b',
      'linear-gradient(139.27deg, #004DB7 16%, #00C18D 100%)',
      'black',
      'white',
      'Gradient: Cobalt - Caribbean Green',
    ],
    [
      '8086ae98-5a59-4a1b-aeb6-6de815ce7c43',
      'linear-gradient(139.27deg, #9300FF 16%, #FF0058 100%)',
      'black',
      'white',
      'Gradient: Electric Purple - Torch Red',
    ],
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
    [
      '451ed569-fb6f-4b61-8b80-e10e25ea7fa2',
      'https://app.cardstack.com/images/prepaid-card-customizations/pattern-1.svg',
      'Cell',
    ],
    [
      '08086b26-0b2d-43aa-a7cc-dffc7ffc45eb',
      'https://app.cardstack.com/images/prepaid-card-customizations/pattern-2.svg',
      'Curtain',
    ],
    [
      'aec7322a-84e2-4969-a03d-022460705fee',
      'https://app.cardstack.com/images/prepaid-card-customizations/pattern-3.svg',
      'Zebra',
    ],
    [
      '78c26684-4e70-4152-996b-f453934d2485',
      'https://app.cardstack.com/images/prepaid-card-customizations/pattern-4.svg',
      'Tangram',
    ],
  ];
  let sql = pgFormat(patternsQueryText, patternRows);
  console.log(sql);
  let result = await db.query(sql);
  console.log(`Upserted ${result.rowCount} prepaid_card_patterns rows`);
}

async function loadNotificationTypes(db: Client) {
  let query = `INSERT INTO notification_types(
    id, notification_type, default_status
  )
  VALUES %L ON CONFLICT (id) DO UPDATE SET
    notification_type = excluded.notification_type,
    default_status = excluded.default_status;`;
  let rows = [
    ['10b75b75-b855-42eb-893e-d223995b8872', 'merchant_claim', 'enabled'],
    ['1137c2b1-fb2e-45d2-9f62-d365b989d151', 'customer_payment', 'enabled'],
  ];
  let sql = pgFormat(query, rows);
  console.log(sql);
  let result = await db.query(sql);
  console.log(`Upserted ${result.rowCount} notification_types rows`);
}
