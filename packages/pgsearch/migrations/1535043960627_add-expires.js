exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("documents", {
    expires: { type: "timestamp with time zone" }
  });
};

