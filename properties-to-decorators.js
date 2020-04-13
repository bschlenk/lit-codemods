export default function transformer(file, api, options) {
  const j = api.jscodeshift;

  j.registerMethods({
    findConstructor() {
      return this.find(j.MethodDefinition, { key: { name: 'constructor' } });
    },

    findStaticProperties() {
      return this.find(j.MethodDefinition, {
        key: { name: 'properties' },
        static: true,
        kind: 'get',
      });
    },

    findThisAssignments(whitelist) {
      return this.find(j.AssignmentExpression, {
        left: { object: { type: 'ThisExpression' } },
      }).filter(
        (e) => !whitelist || whitelist.includes(e.value.left.property.name),
      );
    },
  });

  const root = j(file.source);
  let addedProperties = false;

  root.find(j.ClassDeclaration).forEach((litClass) => {
    const staticPropertiesMethod = j(litClass).findStaticProperties();
    if (!staticPropertiesMethod.size()) {
      // if there is no `static get properties()` method then there's nothing
      // we need to do to this class
      return;
    }

    // the properties returned by the `static get properties` method
    let properties = [];
    // the default property values assigned in the constructor
    const propertyDefaults = {};

    staticPropertiesMethod
      .find(j.ReturnStatement, { argument: { type: 'ObjectExpression' } })
      .at(0)
      .forEach((r) => {
        properties = r.value.argument.properties;
      });

    staticPropertiesMethod.remove();

    const propertyNames = properties.map((p) => p.key.name);

    // extract and remove any default properties that get set in the
    // constructor
    j(litClass)
      .findConstructor()
      .findThisAssignments(propertyNames)
      .forEach((p) => {
        propertyDefaults[p.value.left.property.name] = p.value.right;
      })
      .remove();

    // create a corresponding decorator for each property
    const newClassProperties = properties.map((property) => {
      const type = extractTypeProperty(property);

      return withDecorators(
        withComments(
          j.classProperty(
            property.key,
            propertyDefaults[property.key.name] || null,
            typeToTypeAnnotation(type),
          ),
          property,
        ),
        createDecoratorFunction('property', property.value),
      );
    });

    // insert `newClassProperties` at the beginning of the class
    litClass.value.body.body.splice(0, 0, ...newClassProperties);

    addedProperties = newClassProperties.length !== 0;

    // remove the constructor if it only calls `super()`
    j(litClass)
      .findConstructor()
      .filter((constructor) => {
        const body = constructor.value.value.body.body;
        return body.length === 1 && body[0].expression.callee.type === 'Super';
      })
      .remove();
  });

  if (addedProperties) {
    // add `property` to the `lit-element` import
    let litImport = root
      .find(j.ImportDeclaration, { source: { value: 'lit-element' } })
      .paths()[0];

    // create the `lit-element` import if it doesn't exist
    if (!litImport) {
      litImport = j.importDeclaration([], j.literal('lit-element'));
      root.find(j.Program).paths()[0].value.body.splice(0, 0, litImport);
    } else {
      litImport = litImport.value;
    }

    litImport.specifiers.push(j.importSpecifier(j.identifier('property')));
  }

  return root.toSource();

  function withComments(to, from) {
    to.comments = from.comments;
    return to;
  }

  function withDecorators(node, ...decorators) {
    node.decorators = decorators;
    return node;
  }

  function createDecoratorFunction(name, ...args) {
    return j.decorator(j.callExpression(j.identifier(name), args));
  }

  function extractTypeProperty(prop) {
    let type = null;
    j(prop)
      .find(j.Property, {
        key: { name: 'type' },
        value: { type: 'Identifier' },
      })
      .at(0)
      .forEach((p) => {
        type = p.value.value.name;
      });
    return type;
  }

  function typeToTypeAnnotation(type) {
    if (!type) {
      // lit defaults `type` to String
      type = 'String';
    }

    switch (type) {
      case 'String':
        return j.typeAnnotation(j.stringTypeAnnotation());
      case 'Boolean':
        return j.typeAnnotation(j.booleanTypeAnnotation());
      case 'Array':
      case 'Object': {
        const t = j.typeAnnotation(j.stringTypeAnnotation());
        // add a TODO comment since we won't be able to infer the type for
        // arrays and objects
        t.comments = [j.commentBlock('TODO: fix type', false, true)];
        return t;
      }
    }
  }
}
