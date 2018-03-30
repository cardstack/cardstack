module.exports = function rowToDocument(mapper, schemaModels, type, row) {
  let { schema, table } = mapper.tableForType(type);
  let contentType = schemaModels.find(m => m.type === 'content-types' && m.id === type);
  let fields = contentType.relationships.fields.data.map(ref => schemaModels.find(m => m.type === ref.type && m.id === ref.id));
  let doc = {
    id: row.id,
    type,
    attributes: {},
    relationships: {}
  };

  for (let col of Object.keys(row)) {
    let fieldName = mapper.fieldNameFor(schema, table, col);
    if (fieldName === 'id') { continue; }

    let field = fields.find(f => f.id === fieldName);
    if (!field) { continue; }

    if (field.attributes['field-type'] === '@cardstack/core-types::belongs-to') {
      let relatedId = row[col];

      if (relatedId) {
        doc.relationships[fieldName] = {
          data: {
            id: relatedId,
            type: field.relationships['related-types'].data[0].id // TODO: This doesn't support polymorphic relationships
          }
        };
      }

    } else {
      doc.attributes[fieldName] = convertValue(row[col], field.attributes['field-type']);
    }
  }
  return doc;
};


// This doesn't need to do much yet because we only support the
// simplest types. But other types will need to do more here.
function convertValue(pgValue, fieldType) {
  switch(fieldType) {
  case '@cardstack/core-types::string':
  case '@cardstack/core-types::case-insensitive':
  case '@cardstack/core-types::any':
  case '@cardstack/core-types::boolean':
  case '@cardstack/core-types::date':
  case '@cardstack/core-types::integer':
    return pgValue;
  }
}
