/**
 * Created by jacob on 20/06/2016.
 */
(function (window, $) {

    // ----------------------------------------------------
    // Globals
    // ----------------------------------------------------

    var vis = $('#vis');
    var padding = 10;
    var diameter = Math.min(vis.width()-padding*2, vis.height()-padding*2);
    var radius = diameter / 2;
    var physicalRadius = 1200;
    var ox = radius,
        oy = radius;
    var drawJobs = [];
    var currentJobIndex = null;
    var emergencyStop = false;
    var selectedCarriage = null;
    var selectedPen = null;
    var svg = null;
    var boom = null;
    var boomAngle = 0;
    var north = null;
    var south = null;

    var scaleToVirtual = function (value, physicalRadius) {
        var a = Math.max(physicalRadius, radius);
        var b = Math.min(physicalRadius, radius);
        return b / a * value;
    };

    // ----------------------------------------------------
    // Config
    // ----------------------------------------------------

    var config = {
        speed: 10, // Time to turn 1 degree
        physicalRadius: physicalRadius, // Device radius in mm

        physicalDrawStart: 200, // Closest to centre we can draw in mm
        physicalDrawEnd: 1000, // Furthest from the center
        virtualDrawStart: function() { return scaleToVirtual(config.physicalDrawStart, config.physicalRadius) },
        virtualDrawEnd: function() { return scaleToVirtual(config.physicalDrawEnd, physicalRadius) },

        carriagePairs: [
            {
                id: 1,
                beltpos: scaleToVirtual(0, physicalRadius), // Relative to physicalDrawStart
                pens: [
                    {
                        id: 1,
                        name: 'Inner green',
                        color: 'green',
                        pole: 'north',
                        xoffset: scaleToVirtual(-50, physicalRadius),
                    },
                    {
                        id: 2,
                        name: 'Inner blue',
                        color: 'blue',
                        pole: 'north',
                        xoffset: scaleToVirtual(50, physicalRadius),
                    },
                    {
                        id: 3,
                        name: 'Inner yellow',
                        color: 'yellow',
                        pole: 'south',
                        xoffset: scaleToVirtual(-50, physicalRadius),
                    },
                    {
                        id: 4,
                        name: 'Inner red',
                        color: 'red',
                        pole: 'south',
                        xoffset: scaleToVirtual(50, physicalRadius),
                    }
                ]
            },
            {
                id: 2,
                beltpos: scaleToVirtual(400, physicalRadius), // Relative to physicalDrawStart so = physicalDrawEnd - physicalDrawStart / 2
                pens: [{
                        id: 1,
                        name: 'Outer red',
                        color: 'red',
                        pole: 'north',
                        xoffset: scaleToVirtual(-50, physicalRadius),
                    },
                    {
                        id: 2,
                        name: 'Outer red',
                        color: 'blue',
                        pole: 'south',
                        xoffset: scaleToVirtual(50, physicalRadius),
                    }]
            }
        ]
    };

    // ----------------------------------------------------
    // Helpers
    // ----------------------------------------------------

    var log = function() {
        var msg = "";
        for (x in arguments) msg += " "+arguments[x];
        $('#log ul').append('<li>'+msg+'</li>');
        $('#log .panel-scroller').scrollTop($('#log ul').height());
        console.log(arguments);
    };

    var getCarriagePair = function(id) {
        for (i in config.carriagePairs) {
            if (config.carriagePairs[i].id === id) return config.carriagePairs[i];
        }
    };

    // Take an xy from top left and convert to a point from center of circle
    var pointTransform = function(x,y) {
        var off_x = x - radius;
        var off_y = radius - y;
        var off_c = Math.sqrt( Math.abs(off_x * off_x) + Math.abs(off_y * off_y) );
        var radians = 0;
        if      (off_x>=0 && off_y>=0) { radians = Math.asin(off_x / off_c);  }
        else if (off_x>=0 && off_y<0)  { radians = Math.PI/2 + Math.asin(Math.abs(off_y) / off_c);  }
        else if (off_x<0  && off_y<0)  { radians = Math.PI + Math.asin(Math.abs(off_x) / off_c);  }
        else                           { radians = Math.PI*1.5 + Math.asin(off_y / off_c);  }
        if (isNaN(radians)) radians = 0;
        var degrees = 180/Math.PI * radians;
        return { d: degrees, r: radians, h: off_c / radius, new_x: off_x, new_y: off_y, original_x: x, original_y: y };
    };

    var maxTravel = function() {
        var max_belt_pos = 0;
        for (i in config.carriagePairs) {
            var x = config.carriagePairs[i].beltpos;
            if (max_belt_pos < x) max_belt_pos = x;
        }
        return config.virtualDrawEnd() - max_belt_pos;
    };

    // ----------------------------------------------------
    // UI
    // ----------------------------------------------------

    // Draw the jobs list
    var updateJobsList = function(processingIndex) {
        var jobList = $('#job_list ul');
        jobList.html('');
        $.each(drawJobs, function (k,v) {
            var li = $('<li></li>');
                li.addClass("list-group-item");
                var html  = '<div class="row">';
                    html += '<div class="col-md-3"><i class="fa fa-compass" aria-hidden="true"></i> '+Math.round(v.d)+'&deg; ';
                    html += '</div>';
                    html += '<div class="col-md-3"><i class="fa fa-arrows-h" aria-hidden="true"></i> '+Math.round(v.h*radius)+';'
                    html += '</div>';
                    html += '<div class="col-md-4"><i class="fa fa-pencil" aria-hidden="true"></i> '+((v.pen !==null) ? v.pen.name : 'None');
                    html += '</div>';
                    html += '<div class="col-md-2"><a href="javascript:removeJob('+k+');" class="remove-job"><i class="fa fa-close" ></i></a>';
                    html += '</div>';
                    html += '</div>';
                li.html(html);
            if (v.hasOwnProperty('complete')) li.addClass('complete');
            if (k===processingIndex) li.addClass('current');
            jobList.append(li);
        });
    };

    var updatePensList = function() {
        var hasPenSelected = false;
        var penList = $('#pen_list ul');
        // Wipe clean
        penList.html('');
        // None button
        var unset = $('<li>None</li>');
        unset.attr('class', 'pen-unset list-group-item');
        penList.append(unset);
        // Carriage titles
        $.each(config.carriagePairs, function (k,carriage) {
            var li = $('<li></li>');
            li.html('Carriage '+carriage.id);
            li.attr('class', 'list-group-item list-title');
            penList.append(li);
            // Pen buttons
            $.each(carriage.pens, function (k,pen) {
                var tmp = $('<li></li>');
                    tmp.attr('class', 'list-group-item pen-button');
                    tmp.attr('data-carriage-id', carriage.id);
                    tmp.attr('data-pen-id', pen.id);
                    tmp.html(pen.color+' '+pen.pole);

                if (carriage.id===selectedCarriage && pen.id===selectedPen) {
                    hasPenSelected = true;
                    tmp.attr('class', tmp.attr('class') + ' selected');
                }
                penList.append(tmp);
            });
        });
        if (!hasPenSelected) unset.attr('class', unset.attr('class') + ' selected');
    };

    // ----------------------------------------------------
    // Pen
    // ----------------------------------------------------

    var unSetPen = function() {
        selectedCarriage = null;
        selectedPen = null;
        $('.pen-button').removeClass('selected');
        $('.pen-unset').addClass('selected');
    };

    var setPen = function () {
        selectedCarriage = parseInt($(this).data('carriage-id'));
        selectedPen      = parseInt($(this).data('pen-id'));
        $('.pen-button').removeClass('selected');
        $('.pen-unset').removeClass('selected');
        $('.pen-button[data-carriage-id="' + selectedCarriage + '"][data-pen-id="' + selectedPen + '"]').addClass('selected');
    };

    var getPen = function(carriageId, penId) {
        var carriageId = typeof carriageId !== 'undefined' ?  carriageId : selectedCarriage;
        var penId = typeof penId !== 'undefined' ?  penId : selectedPen;
        var carriage = getCarriagePair(carriageId);
        if (carriage === undefined) return null;
        for (i in carriage.pens) {
            if (carriage.pens[i].id === penId) {
                var tmp = carriage.pens[i];
                tmp['carriage'] = carriage;
                return tmp;
            }
        }
    };

    // ----------------------------------------------------
    // Job Management
    // ----------------------------------------------------

    // Add point to drawing tasks
    var addJob = function(x, y) {

        // Without offset this is where the boom goes
        var mark = pointTransform(x, y);
        // Load selected pen
        var pen = getPen();
        var xoffset = 0;
        var yoffset = 0;

        if (pen!==null) {
            var q = Math.floor(mark.d / 90 % 90);
            var t = mark.r - ((Math.PI / 2) * q);
            t = Math.PI/2 - t;
            if (q === 0) {
                xoffset = Math.sin(t) * pen.xoffset;
                yoffset = Math.cos(t) * pen.xoffset;
            } else if (q === 2) {
                xoffset = - Math.sin(t) * pen.xoffset;
                yoffset = - Math.cos(t) * pen.xoffset;
            } else if (q === 1) {
                xoffset = - Math.cos(t) * pen.xoffset;
                yoffset = Math.sin(t) * pen.xoffset;
            } else if (q === 3) {
                xoffset = Math.cos(t) * pen.xoffset;
                yoffset = - Math.sin(t) * pen.xoffset;
            }
            if (pen.pole==="south") {
                xoffset = -1 * xoffset;
                yoffset = -1 * yoffset;
            }
            // svg.append('circle')
            //     .attr('r', 4)
            //     .attr('cx', x+xoffset)
            //     .attr('cy', y+yoffset)
            //     .attr('fill', 'yellow');
        }

        //
        var job  = pointTransform(x+xoffset, y+yoffset);

        // Add pen to job info
        job.pen = pen;

        // Add job to list
        drawJobs.push(job);

        // Draw marker on surface
        if (pen!==null) {
            svg.append('circle')
                .attr('r', 4)
                .attr('cx', mark.original_x)
                .attr('cy', mark.original_y)
                .attr('fill', pen.color)
                .attr('class', 'marker-' + (drawJobs.length - 1));
        } else {
            svg.append('rect')
              .attr('x', mark.original_x-5)
              .attr('y', mark.original_y-1)
              .attr('width', 10)
              .attr('height', 2)
              .attr('fill', 'grey')
              .attr('class', 'marker-' + (drawJobs.length - 1));
            svg.append('rect')
              .attr('x', mark.original_x-1)
              .attr('y', mark.original_y-5)
              .attr('width', 2)
              .attr('height', 10)
              .attr('fill', 'grey')
              .attr('class', 'marker-' + (drawJobs.length - 1));
        }

        updateJobsList();
    };

    var isJobComplete = function(jobIndex) {
        var job = drawJobs[jobIndex];
        return job.hasOwnProperty('complete');
    };

    var getNextJob = function () {
        if (currentJobIndex===null && drawJobs.length===0) {
            log("No first job");
            return null;
        } else if (currentJobIndex===null && drawJobs.length>0) {
            return 0;
        } else if (currentJobIndex === drawJobs.length) {
            log("No next job");
            return null;
        }
        while(isJobComplete(currentJobIndex)) {
            log("Job complete - skipping");
            currentJobIndex++;
            if (currentJobIndex === drawJobs.length) return null;
        }
        return currentJobIndex;
    };

    var execNextJob = function() {
        var nextJob = getNextJob();
        if (nextJob!==null) execJob(nextJob);
    };

    var execAllJobs = function() {
        if (emergencyStop) {
                emergencyStop = false;
                log("Emergency Stop Applied");
                $('.consumeStop').prop('disabled', true);
                $('.consume-button').prop('disabled',false);
                return;
        }

        var nextJob = getNextJob();
        if (nextJob!==null) {
            $('.consumeStop').prop('disabled', false);
            setTimeout(function() {
                execJob(nextJob, execAllJobs)
            },1000);
        } else {
            $('.consumeStop').prop('disabled', true);
        }
    };

    var execJob = function(jobIndex, cb) {
        // Inform hardwar
        var job = drawJobs[jobIndex];
        sm.emit({
            d: job.d,
            r: job.r,
            h: job.h,
            p: (job.pen!==null) ? job.pen.id : "none"
        });

        // Disable consume buttons
        $('.consume-button').prop('disabled',true);
        // Highlight job as in progress
        updateJobsList(jobIndex);
        // Animate Job
        animateJob(jobIndex, function() {
            currentJobIndex++;
            removeJob(jobIndex);
            $('.consume-button').prop('disabled',false);
            if (cb) cb();
        });
    };

    var removeJob = function(jobIndex) {
        // Remove marker on canvas
        $('.marker-' + jobIndex).remove();
        drawJobs[jobIndex].complete = true;
        updateJobsList();
    };


    // ----------------------------------------------------
    // Animation
    // ----------------------------------------------------

    var animateJob = function(jobIndex, cb) {
        // Disable consume buttons
        $('.consume-button').prop('disabled',true);
        // Animate carriages
        setTimeout(function() { animateCarriages(jobIndex) }, 0);
        // Rotate the boom
        animateBoom(jobIndex, cb);
    };


    var animateBoom = function(jobIndex, cb) {
        var job = drawJobs[jobIndex];
        // If there's a pen associated with the job
        if (job.pen !== null && job.pen !== undefined && job.pen.pole === 'south') {
            abs_angle = ((job.d + 180) % 360);
        } else {
            abs_angle = job.d;
        }
        rotateBoom(abs_angle, cb);
    };


    var rotateBoom = function(abs_angle, cb, force_dir) {
        // Make sure its a number
        abs_angle = abs_angle * 1;
        // Is the boom already at the angle
        if (abs_angle===boomAngle) {
            log("Already at angle ", abs_angle);
            if (cb) cb();
            return;
        }

        var CW  = 1;
        var CCW = -1;
        var is_forced = false;
        if (typeof force_dir !==undefined) { is_forced = true; }

        // Calc different distances
        var dir = (abs_angle > boomAngle) ? CW : CCW;
        var diff_cw=0, diff_ccw=0;
        if (dir===CW) {
            diff_cw  = Math.abs(abs_angle - boomAngle);
            diff_ccw = 360 - Math.abs(abs_angle - boomAngle);
        } else {
            diff_cw = 360 - Math.abs(abs_angle - boomAngle);
            diff_ccw  = Math.abs(abs_angle - boomAngle);
        }
        log("CCW",diff_ccw, "CW", diff_cw);

        // Workout shortest direction of travel
        var auto_dir = 0;
        if (diff_ccw > diff_cw) {
            log("Shortest route is clockwise");
            auto_dir = 1;
        } else {
            log("Shortest route is anticlockwise");
            auto_dir = -1;
        }

        var move_cw  = boomAngle + diff_cw % 360;
        var move_ccw = boomAngle - diff_ccw;

        var to_angle = abs_angle;
        if (is_forced && force_dir===CW) {
            log("Forcing direction CW");
            to_angle = move_cw
        } else if (is_forced && force_dir===CCW) {
            log("Forcing direction CCW");
            to_angle = move_ccw
        } else if (auto_dir===CW) {
            to_angle = move_cw
        } else {
            to_angle = move_ccw
        }

        log("Rotating from: ",boomAngle, " to: ", abs_angle, " moving: ", to_angle);
        // Swing it baby
        boom.transition()
          .duration(function () {
            var distance = Math.max(boomAngle, to_angle) - Math.min(boomAngle, to_angle);
            return config.speed * distance;
          })
          .attrTween("transform", function() {
              return d3.interpolateString("rotate("+boomAngle+", "+ox+", "+ox+")", "rotate("+to_angle+", "+oy+", "+oy+")");
          })
          .each("end", function () {
              if (cb) cb();
              boomAngle = abs_angle;
              $('.stat-angle').text('Angle: '+boomAngle);
        });
    };


    var animateCarriages = function(jobIndex, cb) {
        var job = drawJobs[jobIndex];
        var pen = (job.pen === undefined) ? null : job.pen;
        if (pen===null) { log("No pen selected"); if(cb) cb(false); return; }
        var carriage = pen.carriage;
        // Convert h a percentage of radius to a value
        var h = job.h * radius;
        // Check if withing draw limits
        if (h > config.virtualDrawEnd()) { log("Greater than draw space"); if(cb) cb(false); return; }
        if (h < config.virtualDrawStart()) { log("Less than draw space"); if(cb) cb(false); return; }
        // Check if in pen limits
        var min_pos = config.virtualDrawStart() + carriage.beltpos;
        var max_pos = maxTravel() + carriage.beltpos;
        if (h > max_pos) { log("Greater than pen space"); if(cb) cb(false); return; }
        if (h < min_pos) { log("Less than pen space"); if(cb) cb(false); return; }
        // Position from center to move to
        var from_center = Math.abs(min_pos - h);
        log("Belt needs to move", from_center);
        // Direction of travel
        var direction_of_travel = (from_center > h) ? direction_of_travel = 1 : -1;
        // Animate belt moving
        north.transition()
            .duration(100)
            .attr("transform", "translate(0, "+(direction_of_travel * from_center)+")");
        south.transition()
            .duration(100)
            .attr("transform", "translate(0, "+(-direction_of_travel * from_center)+")");
    };


    // ----------------------------------------------------
    // Build
    // ----------------------------------------------------

    var buildSurface = function(svg) {

        svg.append("circle")
            .attr("r", radius)
            .attr("cx", ox)
            .attr("cy", oy)
            .attr("class", 'draw-surface');

        svg.append("circle")
            .attr("r", 10)
            .attr("cx", ox)
            .attr("cy", oy)
            .attr("class", 'hub');

        // Mark drawable area
        var arc = d3.svg.arc()
            .innerRadius(config.virtualDrawStart())
            .outerRadius(config.virtualDrawEnd())
            .startAngle(0)
            .endAngle(2 * Math.PI);
        svg.append("path")
            .attr("d", arc)
            .attr("class", "draw-zones")
            .attr("transform", "translate("+ox+","+oy+")");

        for (i in config.carriagePairs) {
            svg.append("circle")
            .attr("r", config.virtualDrawStart() + config.carriagePairs[i].beltpos)
            .attr("cx", ox)
            .attr("cy", oy)
            .attr("class", 'beltpos-ring');
        }


        var face = svg.append('g')
		    .attr('id','clock-face')
            .attr('transform','translate(' + ox + ',' + oy + ')');
	    face.selectAll('.degree-tick')
		.data(d3.range(0,360/5)).enter()
			.append('line')
			.attr('class', 'degree-tick')
			.attr('x1',0)
			.attr('x2',0)
			.attr('y1',radius)
			.attr('y2',radius-5)
			.attr('transform',function(d){
				return 'rotate(' + d * 5 + ')';
			});
        var radian = Math.PI / 180;
        var interval = 15;
        var labelradius = radius - 20;
        face.selectAll('.degree-label')
		    .data(d3.range(0,360/interval))
			.enter()
			.append('text')
			.attr('class', 'degree-label')
			.attr('text-anchor','middle')
			.attr('x',function(d){
				return labelradius * Math.sin(d*interval*radian);
			})
			.attr('y',function(d){
				return -labelradius * Math.cos(d*interval*radian);
			})
            .attr('dy', ".35em")
			.text(function(d){
				return d*interval;
			});
    };

    var buildBoom = function (svg) {
        boom = svg.append("g")
            .attr('id', 'boom');

        boom.append("line")
            .attr("x1", ox)
            .attr("y1", oy - radius)
            .attr("x2", ox)
            .attr("y2", oy + radius)
            .attr("stroke-width", 2)
            .style("stroke", 'black');

        poly = [ox+", "+(oy-radius),
                (ox-5)+", "+(oy-radius+10),
                (ox+5)+", "+(oy-radius+10)
        ];

        boom.append("polygon")
            .attr("points", function() { return poly.join(" ") })
            .attr("stroke","black")
            .attr("stroke-width",2);
    };

    var buildCarriages = function (svg) {
        var carriages = boom.append("g")
            .attr("id", "carriages");

        // Great groups for north and south
        north = carriages.append("g").attr("id","north-belt");
        south = carriages.append("g").attr("id","south-belt");

        for (c in config.carriagePairs) {

            var cp = config.carriagePairs[c];

            north.append("circle")
                .attr('class', 'carriage')
                .attr("r", 5)
                .attr("cx", ox)
                .attr("cy", function () {
                    return oy - config.virtualDrawStart() - cp.beltpos;
                });

            south.append("circle")
                .attr('class', 'carriage')
                .attr("r", 5)
                .attr("cx", ox)
                .attr("cy", function () {
                    return oy + config.virtualDrawStart() + cp.beltpos;
                });

            // Add pens
            for (i in cp.pens) {
                var pen  = cp.pens[i];
                var pole = (pen.pole === 'north') ? north : south;

                // Pens
                pen.circle = pole.append("circle")
                    .attr('class', 'pen')
                    .attr("r", 5)
                    .attr("cx", ox - pen.xoffset)
                    .attr("cy", function() {
                        var offset = config.virtualDrawStart() + cp.beltpos;
                        if (pole===north) return oy - offset; else return oy + offset;
                    })
                    .style("fill", pen.color);
            }

        }
    };

    var buildClickLayer = function(svg) {
        var mouseLine = svg.append("line")
            .attr("x1", ox)
            .attr("y1", oy)
            .attr("x2", ox)
            .attr("y2", oy)
            .attr("class", "mouse-line");
        svg.append("circle")
            .attr("r", radius)
            .attr("cx", ox)
            .attr("cy", oy)
            .style("fill", 'transparent')
            .on("mousemove", function () {
                var point = d3.mouse(this);
                mouseLine.attr("x2", point[0]).attr("y2", point[1]);
                d3.event.stopPropagation();
            })
            .on("mouseout", function () {
                mouseLine.attr("x2", ox).attr("y2", oy);
                d3.event.stopPropagation();
            })
            .on("click", function () {
                var point = d3.mouse(this);
                addJob(point[0],point[1]);
                d3.event.stopPropagation();
            });
    };

    var buildStats = function(svg) {
        svg.append('text')
         .attr("x", 10)
         .attr("y", 20)
         .text("")
         .attr("class", "stat stat-angle");
    };

    // ----------------------------------------------------
    // Main
    // ----------------------------------------------------

    svg = d3.select("#vis").append("svg")
            .attr("width", diameter)
            .attr("height", diameter);

    // Web socket setup
    sm = new SocketManager(function (newdata) {
        log("Message:", newdata);
    });
    sm.connect();

    buildSurface(svg);
    buildBoom(svg);
    buildCarriages(svg);
    buildClickLayer(svg);
    updatePensList();
    updateJobsList();
    buildStats(svg);

    d3.select(".consumeOne").on("click", function() {  execNextJob();  });
    d3.select(".consumeAll").on("click", function() {  execAllJobs();  });
    d3.select(".consumeStop").on("click", function() {  emergencyStop = true;  });

    $(".pen-button").on("click", setPen);
    $(".pen-unset").on("click", unSetPen);

    // Public API
    window.rotateBoom = rotateBoom;
    window.removeJob = removeJob;
})(window, jQuery);