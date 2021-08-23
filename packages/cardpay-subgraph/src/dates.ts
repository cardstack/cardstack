import { ethereum, BigInt } from '@graphprotocol/graph-ts';
let SECONDS_IN_DAY = toBigInt(86400);
let ZERO = toBigInt(0);
let ONE = toBigInt(1);

// Ported from http://howardhinnant.github.io/date_algorithms.html#civil_from_days
export function dayMonthYearFromEventTimestamp(event: ethereum.Event): DayMonthYear {
  let unixEpoch: BigInt = event.block.timestamp;

  // you can have leap seconds apparently - but this is good enough for us ;)
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let daysSinceEpochStart = unixEpoch / SECONDS_IN_DAY;
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  daysSinceEpochStart = daysSinceEpochStart + toBigInt(719468);

  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let era: BigInt =
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    (daysSinceEpochStart >= ZERO ? daysSinceEpochStart : daysSinceEpochStart - toBigInt(146096)) / toBigInt(146097);
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let dayOfEra: BigInt = daysSinceEpochStart - era * toBigInt(146097); // [0, 146096]
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let yearOfEra: BigInt =
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    (dayOfEra - dayOfEra / toBigInt(1460) + dayOfEra / toBigInt(36524) - dayOfEra / toBigInt(146096)) / toBigInt(365); // [0, 399]

  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let year: BigInt = yearOfEra + era * toBigInt(400);
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let dayOfYear: BigInt = dayOfEra - (toBigInt(365) * yearOfEra + yearOfEra / toBigInt(4) - yearOfEra / toBigInt(100)); // [0, 365]
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let monthZeroIndexed = (toBigInt(5) * dayOfYear + toBigInt(2)) / toBigInt(153); // [0, 11]
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let day = dayOfYear - (toBigInt(153) * monthZeroIndexed + toBigInt(2)) / toBigInt(5) + toBigInt(1); // [1, 31]
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  let month = monthZeroIndexed + (monthZeroIndexed < toBigInt(10) ? toBigInt(3) : toBigInt(-9)); // [1, 12]

  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  year = month <= toBigInt(2) ? year + ONE : year;

  return new DayMonthYear(day, month, year);
}

class DayMonthYear {
  day: BigInt;
  month: BigInt;
  year: BigInt;

  constructor(day: BigInt, month: BigInt, year: BigInt) {
    this.day = day;
    this.month = month;
    this.year = year;
  }
}

function toBigInt(num: i32): BigInt {
  return BigInt.fromI32(num);
}
