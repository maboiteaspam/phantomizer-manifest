'use strict';

module.exports = function(grunt) {

  var path = require("path")

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

      var ph_libutil = require("phantomizer-libutil");
      var _ = grunt.util._;
      var meta_factory = ph_libutil.meta;

      var options = this.options({
        in_file:'',
        out_file:'',

        meta_file:'',
        meta_dir:'<%= meta_dir %>',
        project_dir:'<%= project_dir %>',

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
      var meta_dir = options.meta_dir;
      var meta_file = options.meta_file;
      var project_dir = options.project_dir;
      var base_url = options.base_url;
      var manifest_file = options.manifest_file;
      var manifest_meta = options.manifest_meta;
      var manifest_url = options.manifest_url;
      var maninfest_reloader = options.manifest_reloader;
      var paths = options.src_paths;
      var version = options.version;
      var cache = options.cache;
      var network = options.network;
      var fallback = options.fallback;

      var meta_manager = new meta_factory( process.cwd(), meta_dir );

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
        var reloader = grunt.file.read(maninfest_reloader);
        html_content = html_content.replace(/<body([^>]+)?>/gi, "<body$1><script type='text/javascript'>"+reloader+"</script>")
        html_content = html_content.replace("<html", "<html manifest=\""+manifest_url+"\"")
        grunt.file.write(out_file, html_content);
        grunt.log.ok("HTML file wrote "+out_file);


// create AppCache meta
        appcache_entry.load_dependencies([
          process.cwd()+"/Gruntfile.js",
          project_dir+"/../config.json",
          __filename,
          in_file])
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
  var ph_libutil  = require("phantomizer-libutil");
  var fs          = require("fs");

  var router_factory    = ph_libutil.router;
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
      var config = grunt.config();

      var router = new router_factory(config.routing);
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
        grunt.log.ok("URL to export: "+urls.length+"/"+(urls.length+not_added.length));


//
        var pages = {};
        var assets = {};
        for( var n in urls ){
          var url = urls[n];
          var in_file = options.target_path + url;
          if( grunt.file.exists( in_file ) ){
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

            pages[url] = {
              file:in_file,
              assets:page_assets
            };
          }
        }



        var reloader = "";
        if( options.maninfest_reloader ){
          if( grunt.file.exists(options.maninfest_reloader) ){
            reloader = grunt.file.read(options.maninfest_reloader);
          }else if( options.maninfest_reloader != "" ){
            reloader = options.maninfest_reloader;
          }
        }


//
        if( options.mode == "one_for_each" ){
          for( var page_url in pages ){
            var page_assets = pages[page_url].assets;
            var html_file = pages[page_url].file;

//
            var cache = [];
            for( var n in options.cache ){
              cache.push(options.cache[n]);
            }
            for( var n in page_assets ){
              cache.push(page_assets[n]);
            }

// generate and write AppCache file
            var manifest_file = html_file.replace(/[.](htm|html)$/,options.appcache_extension);
            var manifest_content = generate_appcache_content(options.version,
              cache,options.network,options.fallback);
            grunt.file.write(manifest_file, manifest_content);

            var html_content = grunt.file.read(html_file);
// load appcache and manifest reloader within html content
            var manifest_url = manifest_file.replace(options.target_path,"");
            manifest_url = manifest_url.substr(0,1)=="/"?manifest_url:"/"+manifest_url;
            html_content = html_content.replace("<html",
              "<html manifest=\""+manifest_url+"\"")

// insert appcache reloader
            if( reloader != "" ){
              html_content = html_content.replace(/<body([^>]+)?>/gi,
                "<body$1><script type='text/javascript'>"+reloader+"</script>");
            }
            grunt.file.write(html_file, html_content);
          }
        }

//
        if( options.mode == "one_for_all" ){

          var manifest_url = "/manifest"+options.appcache_extension;
          var manifest_file = options.target_path+manifest_url;

          for( var page_url in pages ){
            var page_assets = pages[page_url].assets;
            var html_file = pages[page_url].file;

//
            var cache = [];
            for( var n in options.cache ){
              cache.push(options.cache[n]);
            }
            for( var n in page_assets ){
              var page_asset = page_assets[n];
              if( assets[page_asset].ocurence_urls.length >= options.min_occurence_count ){
                cache.push(page_asset);
              }
            }

            var html_content = grunt.file.read(html_file);
// load appcache and manifest reloader within html content
            html_content = html_content.replace("<html",
              "<html manifest=\""+manifest_url+"\"");

// insert appcache reloader
            if( reloader != "" ){
              html_content = html_content.replace(/<body([^>]+)?>/gi,
                "<body$1><script type='text/javascript'>"+reloader+"</script>");
            }
            grunt.file.write(html_file, html_content);
          }

// generate and write AppCache file
          var manifest_content = generate_appcache_content(options.version,
            cache,options.network,options.fallback);
          grunt.file.write(manifest_file, manifest_content);
        }



      })
      grunt.log.ok();
    });





// helpers function
// ---------
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