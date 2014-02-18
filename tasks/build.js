'use strict';

module.exports = function(grunt) {

  var path = require("path");
  var progress = require("progress");
  var ph_libutil = require("phantomizer-libutil");

// Generate a config predefined AppCache file
// ---------
  grunt.registerMultiTask("phantomizer-manifest", "Builds manifest file", function () {

    var options = this.options({
      manifest_file:"",
      version:(new Date().getTime()),
      cache:[],
      network:[],
      fallback:[]
    })
    var content = generate_appcache_content(options.version,options.cache,options.network,options.fallback);
    grunt.file.write(options.manifest_file,content)
    grunt.log.ok("AppCache file wrote "+manifest_file)
  });



// Generate an AppCache file and insert it into the DOM
// ---------
  grunt.registerMultiTask("phantomizer-manifest-html",
    "Builds manifest file given an html file", function () {

      var options = this.options({
        in_file:'',
        out_file:'',

        meta_file:'',

        manifest_file:'',
        manifest_meta:'',
        manifest_url:'',
        manifest_reloader:'<%= manifest_reloader %>',

        base_url:'/',
        src_paths:'<%= paths %>',
        version:""+(new Date().getTime()),
        cache:[],
        network:[],
        fallback:[]
      });

      var in_file = options.in_file;
      var out_file = options.out_file;
      var meta_file = options.meta_file;
      var base_url = options.base_url;
      var manifest_file = options.manifest_file;
      var manifest_meta = options.manifest_meta;
      var manifest_url = options.manifest_url;
      var manifest_reloader = options.manifest_reloader;
      var paths = options.src_paths;
      var version = options.version;
      var cache = options.cache;
      var network = options.network;
      var fallback = options.fallback;

      var Phantomizer = ph_libutil.Phantomizer;
      var phantomizer = new Phantomizer(process.cwd(),grunt);
      var meta_manager = phantomizer.get_meta_manager();

      var current_grunt_task  = this.nameArgs;
      var current_grunt_opt   = this.options();


      if( meta_manager.is_fresh(meta_file, current_grunt_task) == false ){

        var html_content = grunt.file.read(in_file);

        var html_entry = meta_manager.load(meta_file);
        var appcache_entry = meta_manager.create([])

// lookup for assets within html content
        var file_assets = lookup_for_assets(html_content, base_url, paths);

// dispatch assets into AppCache / HTML, cache dependencies
        for( var n in file_assets ){
          var file_path = file_assets[n];
          cache.push(file_path)
          var a_file_path = must_find_in_paths(paths, file_path)
          if( a_file_path != false ){
            if( meta_manager.has(file_path) ){
              var e = meta_manager.load(file_path);
              appcache_entry.load_dependencies(e.dependences)
              html_entry.load_dependencies(e.dependences)
            }
            appcache_entry.load_dependencies([a_file_path])
            html_entry.load_dependencies([a_file_path])
          }
        }

// generate and write AppCache file
        var manifest_content = generate_appcache_content(version,cache,network,fallback);
        grunt.file.write(manifest_file,manifest_content);
        grunt.log.ok("AppCache file wrote "+manifest_file);

// include appcache and manifest reloader within html content
        var reloader = grunt.file.read(manifest_reloader);
        html_content = html_content.replace(/<body([^>]+)?>/gi, "<body$1><script type='text/javascript'>"+reloader+"</script>")
        html_content = html_content.replace("<html", "<html manifest=\""+manifest_url+"\"")
        grunt.file.write(out_file, html_content);
        grunt.log.ok("HTML file wrote "+out_file);


// create AppCache meta
        appcache_entry.load_dependencies([ __filename, in_file])
        appcache_entry.require_task(current_grunt_task, current_grunt_opt)
        appcache_entry.save(manifest_meta)

// create HTML meta
        html_entry.load_dependencies(appcache_entry.dependencies)
        html_entry.require_task(current_grunt_task, current_grunt_opt)
        html_entry.save(meta_file)

        grunt.log.ok("Manifest done "+manifest_url);

      }else{
        grunt.log.ok("Manifest fresh "+manifest_url);
      }


    });



// Generate an AppCache file and insert it into the DOM
// ---------
  //-
  var fs = require("fs");

  grunt.registerMultiTask("phantomizer-project-manifest",
    "Builds manifest files for an entire phantomizer project", function () {

      var options = this.options({
        target_path:"export/",
        appcache_extension:".appcache",
        base_url:"/",
        // one_for_all|one_for_each
        mode:"one_for_all",
        min_occurence_count:2,

        manifest_reloader:'<%= manifest_reloader %>',

        version:""+(new Date().getTime()),
        cache:[],
        network:[],
        fallback:[]
      });

      var done = this.async();

      var Phantomizer = ph_libutil.Phantomizer;
      var phantomizer = new Phantomizer(process.cwd(),grunt);
      var router = phantomizer.get_router();

      router.load(function(){

        // fetch urls to build
        var not_added = [];
        var urls = router.collect_urls(function(route){
          if( route.export == false ){
            not_added.push(route);
            return false;
          }
          return true;
        });
        grunt.log.ok("URL to inject: "+urls.length+"/"+(urls.length+not_added.length));

        var files = grunt.file.expand(
          {cwd:options.target_path},
          ['**/*.html','**/*.htm','!js/**','!css/**',]);

// initialize a progress bar
        var bar = new progress(' done=[:current/:total] elapsed=[:elapseds] sprint=[:percent] eta=[:etas] [:bar]', {
          complete: '#'
          , incomplete: '-'
          , width: 80
          , total: (urls.length+files.length)
        });

        var pages = {};
        var assets = {};
        for( var n in files ){
          var url = "/"+files[n];
          var in_file = options.target_path + files[n];
          var html_content = grunt.file.read(in_file);
          var page_assets = lookup_for_assets(html_content, options.base_url, options.target_path);
          for(var t in page_assets ){
            var page_asset = page_assets[t];
            if( !assets[page_asset] ){
              assets[page_asset] = {
                ocurence_count:0,
                ocurence_urls:[]
              }
            }
            assets[page_asset].ocurence_count++;
            assets[page_asset].ocurence_urls.push(url);
          }

          if( router.match(url) ){
            pages[url] = {
              file:in_file,
              assets:page_assets
            };
          }
          bar.tick();
        }


//
        if( options.mode == "one_for_each" ){
          for( var page_url in pages ){
            var html_file = pages[page_url].file;

// generate and write AppCache file
            var cache = [];
            for( var n in options.cache ){
              cache.push(options.cache[n]);
            }
            for( var n in pages[page_url].assets ){
              cache.push( pages[page_url].assets[n] );
            }
            var manifest_file = html_file.replace(/[.](htm|html)$/,options.appcache_extension);
            var manifest_content = generate_appcache_content(options.version,
              cache,
              options.network,
              options.fallback);
            grunt.file.write(manifest_file, manifest_content);

            var html_content = grunt.file.read(html_file);
// inject manifest within html content
            var manifest_url = manifest_file.replace(options.target_path,"");
            manifest_url = manifest_url.substr(0,1)=="/"?manifest_url:"/"+manifest_url;
            html_content = insert_manifest(manifest_url,html_content);
// inject appcache reloader
            html_content = insert_reloader(options.manifest_reloader,html_content);

            grunt.file.write(html_file, html_content);
            bar.tick();
          }
        }

//
        if( options.mode == "one_for_all" ){

          var manifest_url = "/manifest"+options.appcache_extension;
          var manifest_file = options.target_path+manifest_url;

          for( var page_url in pages ){
            var html_file = pages[page_url].file;

            var html_content = grunt.file.read(html_file);
// inject manifest within html content
            html_content = insert_manifest(manifest_url,html_content);
// inject appcache reloader
            html_content = insert_reloader(options.manifest_reloader,html_content);
            grunt.file.write(html_file, html_content);
            bar.tick();
          }

// generate and write AppCache file
          var cache = [];
          for( var n in options.cache ){
            cache.push(options.cache[n]);
          }
          for( var asset_url in assets ){
            if( assets[asset_url].ocurence_urls.length >= options.min_occurence_count ){
              cache.push(asset_url);
            }
          }
          var manifest_content = generate_appcache_content(options.version,
            cache,
            options.network,
            options.fallback);
          grunt.file.write(manifest_file, manifest_content);
        }

        grunt.log.ok();

        done();

      });
    });





// helpers function
// ---------
  function insert_manifest(manifest_url,html_content){
    html_content = html_content.replace("<html",
      "<html manifest=\""+manifest_url+"\"");
    return html_content;
  }
  function insert_reloader(reloader, html_content){
    if( reloader ){
      if( grunt.file.exists(reloader) ){
        reloader = grunt.file.read(reloader);
      }
      if( reloader ){
        html_content = html_content.replace(/<body([^>]+)?>/gi,
          "<body$1><script type='text/javascript'>"+reloader+"</script>");
      }
    }
    return html_content;
  }
  function generate_appcache_content(version,cache,network,fallback){
    var content = "";
    content += "CACHE MANIFEST" + "\n"
    content += "# version::" + version + "\n"
    content += "CACHE:" + "\n"
    for( var n in cache )
      content += cache[n]+ "\n"
    content += "NETWORK:" + "\n"
    for( var n in network )
      content += network[n]+ "\n"
    content += "FALLBACK:" + "\n"
    for( var n in fallback )
      content += fallback[n].ok+ " "+fallback[n].ko + "\n";

    return content;
  }
  function must_find_in_paths(paths, src){
    var retour = find_in_paths(paths, src)
    if( retour == false ){
      grunt.log.error("File not found : "+src)
    }
    return retour
  }

  function find_in_paths(paths, src){
    for( var t in paths ){
      if( grunt.file.exists(paths[t]+src) ){
        return path.resolve(paths[t]+src)
      }
    }
    return false
  }

// look up for absolute url of assets within html content
  function lookup_for_assets(html_content, base_url, paths){

    var html_utils = ph_libutil.html_utils;

    var retour = [];

// look up for <link> nodes
    var nodes = html_utils.find_link_nodes(html_content, base_url)
    for( var n in nodes ){
      if( find_in_paths(paths,nodes[n].asrc) ){
        retour.push(nodes[n].asrc)
      }
    }

// look up for css / img imports within <styles> nodes
    nodes = html_utils.find_style_nodes(html_content, base_url)
    for( var n in nodes ){
      var node = nodes[n]
      for( var k in node.imports ){
        if( find_in_paths(paths,node.imports[k].asrc) ){
          retour.push(node.imports[k].asrc)
        }
      }
      for( var k in node.imgs ){
        if( find_in_paths(paths,node.imgs[k].asrc) ){
          retour.push(node.imgs[k].asrc)
        }
      }
    }


// look up for <script data-main> nodes
    nodes = html_utils.find_rjs_nodes(html_content, base_url)
    for( var n in nodes ){
      if( find_in_paths(paths,nodes[n].asrc) ){
        retour.push(nodes[n].asrc)
      }s
    }

// look up for <script> nodes
    nodes = html_utils.find_scripts_nodes(html_content, base_url)
    for( var n in nodes ){
      if( find_in_paths(paths,nodes[n].asrc) ){
        retour.push(nodes[n].asrc)
      }
    }

// look up for <img> nodes
    nodes = html_utils.find_img_nodes(html_content, base_url)
    for( var n in nodes ){
      if( find_in_paths(paths,nodes[n].asrc) ){
        retour.push(nodes[n].asrc)
      }
    }
    return retour;
  }

};