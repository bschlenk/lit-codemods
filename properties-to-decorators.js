export default function transformer(file, api) {
  const j = api.jscodeshift;

  let properties;
  const propertyDefaults = {};

  return j(file.source)
    .find(j.ClassDeclaration)
    .forEach((cd) => {
      j(cd)
        .find(j.MethodDefinition, { key: { name: 'properties' } })
        .forEach((md) => {
          properties = md.value.value.body.body[0].argument.properties;
        })
        .remove();

      const propertyNames = properties.map((p) => p.key.name);

      j(cd)
        .find(j.MethodDefinition, { key: { name: 'constructor' } })
        .find(j.AssignmentExpression, { left: { object: j.ThisExpression } })
        .filter((ae) => propertyNames.includes(ae.value.left.property.name))
        .forEach((ae) => {
          propertyDefaults[ae.value.left.property.name] = ae.value.right;
        })
        .remove();

      properties.reverse().forEach((p) => {
        let type = j(p)
          .find(j.Property, { key: { name: 'type' } })
          .at(0);
        if (type.size()) {
          type = type.nodes()[0].value.name;
        } else {
          type = null;
        }
        const cp = j.classProperty(
          p.key,
          propertyDefaults[p.key.name] || null,
          typeToTypeAnnotation(j, type),
        );
        cp.decorators = [
          j.decorator(j.callExpression(j.identifier('property'), [p.value])),
        ];
        cp.leadingComments = p.leadingComments;
        console.log(cp);
        cd.value.body.body.splice(0, 0, cp);
      });

      j(cd)
        .find(j.MethodDefinition, { key: { name: 'constructor' } })
        .filter((md) => {
          const body = md.value.value.body.body;
          return (
            body.length === 1 && body[0].expression.callee.type === 'Super'
          );
        })
        .remove();
    })
    .toSource();
}

function typeToTypeAnnotation(j, type) {
  if (!type) {
    type = 'String';
  }
  switch (type) {
    case 'String':
      return j.typeAnnotation(j.stringTypeAnnotation());
    case 'Boolean':
      return j.typeAnnotation(j.booleanTypeAnnotation());
    case 'Array':
    case 'Object':
      return j.typeAnnotation(j.neverTypeAnnotation());
  }
}

function isSuperOnlyConstructor(j, root) {}
