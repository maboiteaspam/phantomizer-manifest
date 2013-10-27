'use strict';

module.exports = function(grunt) {

    var path = require("path")

// task to generate arbritrary AppCache file
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



// Task to build AppCache manifest given an html file
    grunt.registerMultiTask("phantomizer-manifest-html", "Builds manifest file given an html file", function () {

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
            var nodes = html_utils.find_scripts_nodes(html_content, base_url)
            for( var n in nodes ){
                if( find_in_paths(paths,nodes[n].asrc) ){
                    retour.push(nodes[n].asrc)
                }
            }

// look up for <img> nodes
            var nodes = html_utils.find_img_nodes(html_content, base_url)
            for( var n in nodes ){
                if( find_in_paths(paths,nodes[n].asrc) ){
                    retour.push(nodes[n].asrc)
                }
            }
            return retour;
        }

    });

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

    function find_abs_request(paths, src){
        for( var t in paths ){
            if( grunt.file.exists(paths[t]+src) ){
                var f = path.resolve(paths[t]+src)
                return f.substr(paths[t].length)
            }
        }
        return false
    }
};