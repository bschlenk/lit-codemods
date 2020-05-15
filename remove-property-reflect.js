export default function transformer(file, api, options) {
  const j = api.jscodeshift;

  registerMethods(j);

  const PRIMITIVES = ['String', 'Number', 'Boolean'];

  return j(file.source)
    .find(j.ClassDeclaration)
    .findStaticProperties()
    .find(j.ReturnStatement, {
      argument: { type: 'ObjectExpression' },
    })
    .at(0)
    .find(j.ObjectExpression)
    .filter((oe) => oe.parentPath.value.type === 'Property')
    .find(j.Property, { key: { name: 'reflect' } })
    .filter(canRemoveReflect)
    .remove()
    .toSource();

  function canRemoveReflect(path) {
    const type = path.parentPath.value.find((f) => f.key.name === 'type');
    const canDefault = !type || PRIMITIVES.includes(type.value.name);
    const reflectIsTrue = path.value.value.value === true;
    return canDefault && reflectIsTrue;
  }
}

let registered = false;
function registerMethods(j) {
  if (registered) return;
  j.registerMethods({
    findStaticProperties() {
      return this.find(j.MethodDefinition, {
        key: { name: 'properties' },
        static: true,
        kind: 'get',
      });
    },
  });
  registered = true;
}
