'use strict';

module.exports = function(grunt) {

    var path = require("path")

    grunt.registerMultiTask("phantomizer-manifest", "Builds manifest file", function () {

        var options = this.options()
        var manifest_file = options.manifest_file || ""
        var version = options.version || ""+(new Date().getTime())
        var cache = options.cache || []
        var network = options.network || []
        var fallback = options.fallback || []

        var content = "";
        /*
         CACHE MANIFEST
         # on peut omettre cette ligne car CACHE: est la section par défaut
         CACHE:
         index.html
         css/style.css
         # Ressources qui nécessitent que l'utilisateur soit en ligne
         NETWORK:
         img/logo.png
         # offline.html sera utilisé si online.html n'est pas accessible
         # offline.html sera utilisé à la place des autres fichiers html s'ils ne sont pas accessibles
         FALLBACK:
         online.html offline.html
         *.html offline.html
         */
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
            content += fallback[n].ok+ " "+fallback[n].ko + "\n"

        grunt.file.write(manifest_file,content)
    })

    grunt.registerMultiTask("phantomizer-manifest-html", "Builds manifest file", function () {

        var _ = grunt.util._;
        var ph_libutil = require("phantomizer-libutil");

        var meta_factory = ph_libutil.meta;
        var html_utils = ph_libutil.html_utils;

        var options = this.options();;

        var in_file = options.in_file;
        var out_file = options.out_file || "";
        var meta_file = options.meta_file || "";
        var base_url = options.base_url || "/";
        var meta_dir = options.meta_dir || "";
        var manifest_file = options.manifest_file || "";
        var manifest_meta = options.manifest_meta || "";
        var manifest_url = options.manifest_url || "";
        var maninfest_reloader = options.manifest_reloader || "";
        var paths = options.paths || [];
        var version = options.version || ""+(new Date().getTime());
        var cache = options.cache || [];
        var network = options.network || [];
        var fallback = options.fallback || [];

        var meta_manager = new meta_factory( process.cwd(), meta_dir )

        if( meta_manager.is_fresh(meta_file) == false ){

            var html_content = grunt.file.read(in_file)

            var html_entry = meta_manager.create([])
            if( meta_manager.has(in_file) ){
                var p_html_entry = meta_manager.load(in_file)
                html_entry.load_dependencies(p_html_entry.dependences)
            }
            var appcache_entry = meta_manager.create([])

            var push_src_file = function(file_path){
                cache.push(file_path)
                var a_file_path = must_find_in_paths(paths, file_path)
                if( a_file_path != false ){
                    if( meta_manager.has(meta_file) ){
                        var e = meta_manager.load(meta_file);
                        appcache_entry.load_dependencies(e.dependences)
                        html_entry.load_dependencies(e.dependences)
                    }else{
                        appcache_entry.load_dependencies([a_file_path])
                        html_entry.load_dependencies([a_file_path])
                    }
                }
            }

            var nodes = html_utils.find_link_nodes(html_content, base_url)
            for( var n in nodes ){
                push_src_file(nodes[n].asrc)
            }
            nodes = html_utils.find_style_nodes(html_content, base_url)
            for( var n in nodes ){
                var node = nodes[n]
                for( var k in node.imports ){
                    push_src_file(node.imports[k].asrc)
                }
                for( var k in node.imgs ){
                    push_src_file(node.imgs[k].asrc)
                }
            }
            nodes = html_utils.find_rjs_nodes(html_content, base_url)
            for( var n in nodes ){
                push_src_file(nodes[n].asrc)
            }

            var nodes = html_utils.find_scripts_nodes(html_content, base_url)
            for( var n in nodes ){
                push_src_file(nodes[n].asrc)
            }

            var nodes = html_utils.find_img_nodes(html_content, base_url)
            for( var n in nodes ){
                push_src_file(nodes[n].asrc)
            }


            var content = ""
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
                content += fallback[n].ok+ " "+fallback[n].ko + "\n"

            grunt.file.write(manifest_file,content)
            grunt.log.ok("File created "+manifest_file)

            var reloader = grunt.file.read(maninfest_reloader)
            html_content = html_content.replace("<body>", "<body><script type='text/javascript'>"+reloader+"</script>")
            html_content = html_content.replace("<html", "<html manifest=\""+manifest_url+"\"")
            grunt.file.write(out_file, html_content)
            grunt.log.ok("File created "+out_file)


            var current_grunt_task  = this.nameArgs;
            var current_grunt_opt   = this.options();
            // create a cache entry, so that later we can regen or check freshness
            if ( grunt.file.exists(process.cwd()+"/Gruntfile.js")) {
                appcache_entry.load_dependencies([process.cwd()+"/Gruntfile.js"])
            }
            appcache_entry.load_dependencies([__filename, in_file])
            appcache_entry.require_task(current_grunt_task, current_grunt_opt)
            appcache_entry.save(manifest_meta)

            html_entry.load_dependencies(appcache_entry.dependencies)
            html_entry.require_task(current_grunt_task, current_grunt_opt)
            html_entry.save(meta_file)
        }else{

        }

    })

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