"use strict";

require("better-log/install");

var _babelTemplate = require("babel-template");
var babylon = require("babylon");

var _babelTemplate2 = _interopRequireDefault(_babelTemplate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var buildModule = (0, _babelTemplate2.default)(`
define([IMPORT_PATHS], function(IMPORT_VARS) {
  var importHelper = {
    createInteropRequire: function (moduleImports, importName, moduleName, moduleExports) {
      if (moduleExports && !moduleImports[importName]) {
        Object.defineProperty(moduleImports, importName, { 
          get: function() { 
            if (!moduleExports.__esModule && moduleName == 'default') { 
                return moduleExports; 
            } else { 
                return moduleExports[moduleName];
            }
          } 
        });
      }
    }
  };
  
  var imports = {};
  NAMED_IMPORTS;
  with (imports) { 
    (function(){
      "use strict";
      BODY;
    })();
  }
});
`);

module.exports = function (_ref) {
  var t = _ref.types;

  return {
    visitor: {
      Program: {
        exit: function exit(path, file) {
          var body = path.get("body"),
              sources = [],
              anonymousSources = [],
              vars = [],
              namedImports = [],
              isModular = false,
              middleDefaultExportID = false,
              middleExportIDs = []


          for (var i = 0; i < body.length; i++) {
            var _path = body[i],
                isLast = i == body.length - 1;

            if (_path.isExportDefaultDeclaration()) {
              var declaration = _path.get("declaration");
              middleDefaultExportID = _path.scope.generateUidIdentifier("export_default");
              if(declaration.node.type === "FunctionDeclaration"){
                _path.replaceWith(t.variableDeclaration('var', [
                  t.variableDeclarator(middleDefaultExportID, t.functionExpression(null,declaration.node.params, declaration.node.body))
                ]));
              } else {
                _path.replaceWith(t.variableDeclaration('var', [t.variableDeclarator(middleDefaultExportID, declaration.node)]));
              }

              isModular = true;
            }  else if (_path.isExportDeclaration()){

              var declaration = _path.node.declaration;
              if (!!declaration) {
                _path.replaceWith(declaration);
                if(declaration.type === 'FunctionDeclaration'){
                  middleExportIDs.push(declaration.id);
                } else {
                  declaration.declarations.forEach(d => middleExportIDs.push(d.id));
                }
              } else {
                _path.node.specifiers.map(({ exported }) => middleExportIDs.push(exported));
                _path.remove();
              }
              isModular = true;
            }

            if (_path.isImportDeclaration()) {
              var specifiers = _path.node.specifiers;

              if (specifiers.length == 0) {
                anonymousSources.push(_path.node.source);
              } else {
                var importedID = _path.scope.generateUidIdentifier(_path.node.source.value);
                sources.push(_path.node.source);
                vars.push(importedID);

                specifiers.forEach(function (_ref2) {
                  var imported = _ref2.imported;
                  var local = _ref2.local;
                  var type = _ref2.type;

                  if (imported) {
                    var importHelper = t.memberExpression(t.identifier("importHelper"), t.identifier("createInteropRequire"));
                    namedImports.push(t.callExpression(importHelper, [t.identifier("imports"), t.stringLiteral(local.name), t.stringLiteral(imported.name), t.identifier(importedID.name)]));
                  } else if (type == 'ImportDefaultSpecifier') {
                    var importHelper = t.memberExpression(t.identifier("importHelper"), t.identifier("createInteropRequire"));
                    namedImports.push(t.callExpression(importHelper, [t.identifier("imports"), t.stringLiteral(local.name), t.stringLiteral('default'), t.identifier(importedID.name)]));
                  }
                });
              }

              _path.remove();

              isModular = true;
            }

            if (isLast) {
              var importExpressions = [
                t.objectProperty(t.stringLiteral('__esModule'), t.booleanLiteral(true))
              ];
              
              if (middleDefaultExportID) {
                importExpressions.push(t.objectProperty(t.stringLiteral('default'), middleDefaultExportID));
              }
              
              if (middleExportIDs.length > 0) {
                importExpressions = importExpressions.concat(middleExportIDs.map(id => t.objectProperty(t.stringLiteral(id.name), id)));
              }
              
              if (importExpressions.length > 0) {
                sources.unshift(t.stringLiteral('exports'));
                var exportsPath = path.scope.generateUidIdentifier('exports');
                vars.unshift(exportsPath);
                
                _path.insertAfter(t.callExpression(t.memberExpression(t.identifier("Object"), t.identifier("assign")), [
                  exportsPath,
                  t.objectExpression(importExpressions)
                ]));
              }

            }
          }

          if (isModular) {
            path.node.body = [buildModule({
              IMPORT_PATHS: sources.concat(anonymousSources),
              IMPORT_VARS: vars,
              BODY: path.node.body,
              NAMED_IMPORTS: namedImports
            })];
          }
        }
      }
    }
  };
};
