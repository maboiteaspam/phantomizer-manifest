# phantomizer-manifest v0.1.x

> HTML AppCache support for Phantomizer project

phantomizer-manifest is a grunt task specialized
in producing html application cache files given a Phantomizer project.


Find out more about Phantomizer

http://github.com/maboiteaspam/phantomizer


#### Example config

```javascript
{
  'phantomizer-manifest': {     // Task
    "arbitrary": {              // Target
      options: {                // Target options
            manifest_file:"",
            version:"",
            cache:[],
            network:[],
            fallback:[]
      }
    },
    'phantomizer-html-manifest':{   // Task
        "html-file": {              // Target
          options: {                // Target options
                in_file:'',
                out_file:'',

                meta_file:'',

                manifest_file:'',
                manifest_meta:'',
                manifest_url:'',
                manifest_reloader:'',

                base_url:'/',
                paths:[],
                version:"",
                cache:[],
                network:[],
                fallback:[]
          }
        }
    }
  }
}

```


## Release History


---

