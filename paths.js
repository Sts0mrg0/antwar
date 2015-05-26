'use strict';
var _ = require('lodash');
var removeMd = require('remove-markdown');

var themeFunctions = require('theme').functions || {};

var MdHelper = require('./elements/MdHelper');
var itemHooks = require('./itemHooks');
var config = require('config');
var siteFunctions = config.functions || {} ;

function allItems() {
  var items = [].concat.apply([], _.keys(config.paths).map(function(sectionName) {
    var section = config.paths[sectionName];

    var paths = parseModules(sectionName, section, section.path());

    var draftPaths = [];
    if(__DEV__ && section.draft) {
      draftPaths = parseModules(sectionName, section, section.draft()).map(function(module) {
        module.draft = true; // TODO: rename as isDraft to make this clearer

        return module;
      });
    }

    return (section.sort || id)(paths.concat(draftPaths));
  }));

  items = itemHooks.preProcessItems(items);

  var ret = {};
  _.each(items, function(o) {
    var processedFile = processItem(o.file, o.name, o.section);

    ret[processedFile.url] = processedFile;
  });

  return itemHooks.itemProcessItems(ret);
}
exports.allItems = allItems;

function parseModules(sectionName, section, modules) {
  return _.map(modules.keys(), function(name) {
    var onlyName = name.slice(2); // eliminate ./

    return {
      path: sectionName,
      name: onlyName,
      url: sectionName + '/' + onlyName,
      file: modules(name),
      section: section,
    };
  });
}

function allPages() {
  // TODO: allow hooks on page processing
  var req = pageReq();
  var pages = {};

  _.each(req.keys(), function(name) {
    // name is format ./url_title.ext
    var file = req(name); // require the file
    var fileName = name.slice(2); // remove the './'

    var content = renderContent(file);

    // url is filename minus extension
    var url = _.kebabCase(fileName.split('.')[0]);

    // title is the capitalized url
    var title = _.capitalize(url.replace(/\-/g, ' '));

    // rewrite the index file
    if(url === 'index') {
      url = '/';
    }

    pages[url] = {
      url: url,
      fileName: fileName,
      title: title,
      content: content,
    };
  });
  pages = itemHooks.itemProcessPages(pages);
  return pages;
}
exports.allPages = allPages;

function itemForPath(path) {
  return allItems()[path];
}
exports.itemForPath = itemForPath;

function pageForPath(path) {
  return allPages()[path];
}
exports.pageForPath = pageForPath;

function pageReq() {
  return require.context('pages', false);
}
exports.pageReq = pageReq;

function renderContent(content) {
  return MdHelper.render(content);
}
exports.renderContent = renderContent;

function processItem(o, fileName, sectionFunctions) {
  var functions = _.assign({
    url: function(file, fileName) {
      return fileName.slice(0, fileName.length - 3);
    },
    date: function(file, fileName) {
      return file.date || fileName.slice(0, 10);
    },
    content: function(file, fileName) {
      return MdHelper.render(file.__content);
    },
    preview: function(file, fileName) {
      if (file.preview) {
        return file.preview;
      }
      else {
        var previewLimit = 100;
        var stripped = removeMd(file.content);

        if (stripped.length > previewLimit) {
          return stripped.substr(0, previewLimit) + '…';
        }

        return stripped;
      }
      return file.preview || MdHelper.getContentPreview(file.__content);
    },
    title: function(file, fileName) {
      return file.title;
    }
  }, themeFunctions, siteFunctions, sectionFunctions);

  _.forEach(functions, function(fn, name) {
    o[name] = fn(o, fileName);
  });

  return o;
}

function id(a) {return a;}
