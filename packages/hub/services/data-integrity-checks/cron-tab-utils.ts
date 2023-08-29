const parseInterval = (expression: string) => {
  // '*/5 * * * * print-queued-jobs'
  if (expression.startsWith('*/')) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');
    if (hour == '*' && dayOfMonth == '*' && month == '*' && dayOfWeek == '*') {
      let minuteString = minute.split('/')[1];
      let m = parseInt(minuteString);
      if (!isNaN(m)) {
        return m;
      }
    }
  }
  return;
};

const parseDailyInterval = (expression: string) => {
  // '0 5 * * * remove-old-sent-notifications ?max=5
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');
  if (dayOfMonth == '*' && month == '*' && dayOfWeek == '*') {
    if (!isNaN(parseInt(minute)) && !isNaN(parseInt(hour))) {
      if (dayOfMonth == '*') {
        return 60 * 24;
      }
    }
  }
  return;
};

export function calculateMinuteInterval(expression: string) {
  const identifier = expression.split(' ')[5];
  const minuteInterval = parseInterval(expression) || parseDailyInterval(expression);

  if (minuteInterval === undefined) {
    throw new Error(`Cannot parse the provided cron expression: ${expression}`);
  }

  return {
    identifier,
    minuteInterval,
  };
}
