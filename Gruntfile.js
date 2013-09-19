
module.exports = function(grunt) {

    var d = __dirname+"/vendors/phantomizer-manifest";

    var out_dir = d+"/demo/out/";
    var meta_dir = d+"/demo/out/";


    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json')

        ,"out_dir":out_dir
        ,"meta_dir":meta_dir

        //-
        ,'phantomizer-manifest': {
            options: {
                "out_file":""
                ,"version":""
                ,"cache":[
                    "some/file.css"
                    ,"some/file.js"
                ]
                ,"network":[
                    "some/file.jpeg"
                    ,"some/file.png"
                ]
                ,"fallback":[
                    {"ok":"some/file.html", "ko":"some/fallback.html"}
                    ,{"ok":"some/file.html", "ko":"some/fallback.html"}
                ]
            }
            ,test: {
                options:{
                }
            }
        }
    });

    grunt.loadNpmTasks('phantomizer-manifest');

    grunt.registerTask('default',
        [
            'phantomizer-manifest:test'
        ]);
};
