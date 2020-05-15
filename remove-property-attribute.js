export default function transformer(file, api, options) {
  const j = api.jscodeshift;

  registerMethods(j);

  return j(file.source)
    .find(j.ClassDeclaration)
    .findStaticProperties()
    .find(j.ReturnStatement, {
      argument: { type: "ObjectExpression" }
    })
    .at(0)
    .find(j.ObjectExpression)
    .filter((oe) => oe.parentPath.value.type === "Property")
    .find(j.Property, { key: { name: "attribute" } })
    .filter((p) => {
      const key = p.parentPath.parentPath.parentPath.value.key.name;
      const val = p.value.value.value;
      if (!val) return false;
      const k = kebab(key);
      return k === val;
    })
    .remove()
    .toSource();
}

function kebab(str) {
  return str.replace(/([a-z]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
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
