// Peity jQuery plugin version 1.2.0
// (c) 2013 Ben Pickles
//
// http://benpickles.github.io/peity
//
// Released under MIT license.
(function($, document, devicePixelRatio) {
  var canvasSupported = document.createElement("canvas").getContext;
  var peity = $.fn.peity = function(type, options) {
    if (canvasSupported) {
      this.each(function() {
        var $this = $(this);
        var chart = $this.data("peity");
        
        if (chart) {
          if(type) chart.type = type;
          $.extend(chart.opts, options);
          chart.draw();
        } else {
          var defaults = peity.defaults[type];
          var data = {};
          $.each($this.data(), function(name, value) { if(name in defaults) data[name] = value; });
          
          var opts = $.extend({}, defaults, data, options);
          var chart = new Peity($this, type, opts);
          chart.draw();
          
          $this.change(function(a,b,c) { chart.draw(); }).data("peity", chart);
        }
      });
    }
    
    return this;
  };
  
  var Peity = function($el, type, opts) { this.$el = $el; this.type = type; this.opts = opts; }
  var PeityPrototype = Peity.prototype;
  
  PeityPrototype.colours = function() {
    var colours = this.opts.colours;
    if ($.isFunction(colours)) return colours;
    else return function(_, i) { return colours[i % colours.length]; }
  }
  
  PeityPrototype.draw = function() { peity.graphers[this.type].call(this, this.opts); }
  
  PeityPrototype.prepareCanvas = function(width, height) {
    var canvas = this.canvas;
    var $canvas;
    
    //If pre-existing canvas, clear it, otherwise create it.
    if (canvas) {
      this.context.clearRect(0, 0, canvas.width, canvas.height);
      $canvas = $(canvas);
    } else {
      $canvas = $("<canvas>").css({ height: height, width: width }).addClass("peity").data("peity", this);
      this.canvas = canvas = $canvas[0];
      this.context = canvas.getContext("2d");
      this.$el.hide().after(canvas);
    }
    
    canvas.height = $canvas.height() * devicePixelRatio;
    canvas.width = $canvas.width() * devicePixelRatio;
    
    return canvas;
  }
  
  //Splits values string into array by delimiter and returns the numbers
  PeityPrototype.values = function() { return this.$el.text().split(this.opts.delimiter).map(function(value) { return parseFloat(value); }); }
  
  //Default options and drawing functions per type
  peity.defaults = {}; peity.graphers = {};
  peity.register = function(type, defaults, grapher) { this.defaults[type] = defaults; this.graphers[type] = grapher; }
  
  //Pie chart
  peity.register('pie', {
      colours: ["#ff9900", "#fff4dd", "#ffc66e"],
      delimiter: null,
      diameter: 16
    },
    function(opts) {
      if (!opts.delimiter) {
        //Default to first non-digit and non-period character found, or comma
        var delimiter = this.$el.text().match(/[^0-9\.]/);
        opts.delimiter = delimiter ? delimiter[0] : ",";
      }
      
      var values = this.values();
      
      //If something like 3/5, then this makes 3 and 2
      if (opts.delimiter == "/") {
        var v1 = values[0];
        var v2 = values[1];
        values = [v1, v2 - v1];
      }
      
      var i, sum = 0, length = values.length;
      for (i = 0; i < length; i++) { sum += values[i]; }
      
      //Try width and height, but default to diameter (add 1 for a slight offset
      var canvas = this.prepareCanvas((opts.width || opts.diameter)+1, (opts.height || opts.diameter)+1);
      var context = this.context;
      var width = canvas.width;
      var height = canvas.height;
      var radius = Math.min(width, height) / 2 - 2;//Make a perfect circle
      var pi = Math.PI;
      var unit = 2 * pi / sum;
      var colours = this.colours();
      
      //Save state and then move axes to be in center
      context.save();
      context.translate(width / 2, height / 2);
      context.rotate(-pi / 2);
      
      var value, slice;
      for (i = 0; i < length; i++) {
        value = values[i];
        slice = value * unit;//Size of slice
        
        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, radius, 0, slice, false);
        /*
        if slice is hovered, expand slice radius by (1/16 * radius) and add border
        context.strokeStyle = "#000";
        context.lineWidth = 2;
        context.stroke();
        */
        context.fillStyle = colours.call(this, value, i, values);
        context.fill();
        context.rotate(slice);
      }
      context.restore();//Reset translation and rotation
    }
  )
  
  //Line Chart
  peity.register("line", {
      colour: "#c6d9fd",
      strokeColour: "#4d89f9",
      strokeWidth: 1,
      delimiter: ",",
      height: 16,
      max: null,
      min: 0,
      width: 32
    },
    function(opts) {
      var values = this.values();
      if (values.length == 1) values.push(values[0])
      var max = Math.max.apply(Math, values.concat([opts.max]));
      var min = Math.min.apply(Math, values.concat([opts.min]));
      
      var canvas = this.prepareCanvas(opts.width, opts.height);
      var context = this.context;
      var width = canvas.width;
      var height = canvas.height;
      var xQuotient = width / (values.length - 1);
      var yQuotient = height / (max - min);
      
      var coords = [];
      var i;
      
      context.beginPath();
      context.moveTo(0, height + (min * yQuotient))
      
      for (i = 0; i < values.length; i++) {
        var x = i * xQuotient;
        var y = height - (yQuotient * (values[i] - min));
        
        coords.push({ x: x, y: y });
        context.lineTo(x, y);
      }
      
      context.lineTo(width, height + (min * yQuotient));
      context.fillStyle = opts.colour;
      context.fill();
      
      if (opts.strokeWidth) {
        context.beginPath();
        context.moveTo(0, coords[0].y);
        for (i = 0; i < coords.length; i++) {
          context.lineTo(coords[i].x, coords[i].y);
        }
        context.lineWidth = opts.strokeWidth * devicePixelRatio;
        context.strokeStyle = opts.strokeColour;
        context.stroke();
      }
    }
  );
  
  //Bar chart
  peity.register('bar', {
      baselineHeight : 1,
      baselineColour : "#000000",
      fontColour : "#000000",
      fontStyle : "12pt Arial, sans-serif",
      focusWidth : 0,
      focusColour : "#000",
      colours: ["#4D89F9"],
      delimiter: ",",
      height: 16,
      max: null,
      min: 0,
      spacing: 1,
      width: 32
    },
    function(opts) {
      //Declare variables
      var i, x, y, h, w, value, newY, newH;
      
      //Find minimum and maximum in values to determine range
      var values = this.values()
      var max = Math.max.apply(Math, values.concat([opts.max]));
      var min = Math.min.apply(Math, values.concat([opts.min]))
      
      //Assign elements and options to variables
      var element = this.$el;
      var mousePosition = element.data("position");
      var canvas = this.prepareCanvas(opts.width, opts.height);
      var context = this.context;
      var spacing = opts.spacing;
      var colours = this.colours();
      var focusWidth = opts.focusWidth;
      
      //Size
      var width = canvas.width - spacing * 2
      var height = canvas.height - spacing * 2;
      if(opts.baselineHeight) height -= 1;
      var yQuotient = height / (max - min);//Height of bar of value 1
      var xQuotient = (width + spacing) / values.length;//Width of bar
      var middle = yQuotient * max + spacing;
      
      //Draw baseline
      context.fillStyle = opts.baselineColour;
      context.fillRect(0, middle - (opts.baselineHeight / 2),canvas.width, opts.baselineHeight);
      
      //Loop through values and draw each bar
      for (i = 0; i < values.length; i++) {
        //X position and width
        x = spacing + i * xQuotient;
        w = xQuotient - spacing;
        
        //Use value to determine height
        value = values[i];
        y = spacing + height - (yQuotient * (value - min));
        if (value == 0) {//Special case for 0 - make 1px high in middle
          if (min >= 0 || max > 0) y -= 1;
          h = 1;
        } else { h = yQuotient * values[i]; }
        
        //Draw the bar
        context.fillStyle = colours.call(this, value, i, values);
        context.fillRect(x, y, w, h);
      }
      //Draw focus around hovered rectangle and write value
      if(focusWidth > 0 && mousePosition){
        mousePosition = JSON.parse(mousePosition);
        //Loop through values again
        for (i = 0; i < values.length; i++) {
          
          //Check if mouse is within this bar's horizontal space
          x = spacing + i * xQuotient;
          w = xQuotient - spacing;
          if(mousePosition.x >= x && mousePosition.x <= x+w){
            
            //Now check if mouse is within this bar's vertical space
            value = values[i];
            y = spacing + height - (yQuotient * (value - min));
            if (value == 0) {
              if (min >= 0 || max > 0) y -= 1;
              h = 1;
            } else {
              h = yQuotient * values[i];
            }
            
            //To make comparison easier, make h positive and adjust y
            newY = y + (h < 0 ? h : 0);
            newH = h < 0 ? -h : h;
            if(mousePosition.y >= newY && mousePosition.y <= newY+newH){
              //If mouse is within a bar, draw a focus
              context.strokeStyle=opts.focusColour;
              context.lineWidth=focusWidth;
              context.strokeRect(
                x - focusWidth / 2, newY - focusWidth / 2,
                w + focusWidth, newH + focusWidth
              );
              context.fillStyle = opts.fontColour;
              context.font = opts.fontStyle;
              if(mousePosition.x > canvas.width / 2) context.textAlign = "right";
              if(mousePosition.y < canvas.height / 2) { context.textBaseline = "top"; mousePosition.y += 20; }
              context.fillText(value + "",mousePosition.x,mousePosition.y)
            }
          }
        }
      }
      
      canvas.addEventListener('mousemove', function canvasHover(evt) {
        this.removeEventListener('mousemove',canvasHover,false);
        var rect = canvas.getBoundingClientRect();
        var pos = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
        element.data("position",JSON.stringify(pos)).change();
      }, false);
    }
  );
  
  //Future Combo chart
})(jQuery, document, window.devicePixelRatio || 1);
