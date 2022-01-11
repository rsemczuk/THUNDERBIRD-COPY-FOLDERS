let gulp = require('gulp');
let htmlmin = require('gulp-htmlmin');
var scss = require('gulp-sass')(require('sass'));
let minifyCSS = require('gulp-csso');
let uglify = require('gulp-uglify-es').default;
let minify = require('gulp-minify');
let preprocess = require('gulp-preprocess');
let prettyData = require('gulp-pretty-data');
let clean = require('gulp-clean');
let newer = require('gulp-newer');
let ts = require('gulp-typescript');
let zip = require('gulp-zip');

let tsProject = ts.createProject("tsconfig.json");

let configuredExtensions = [];

gulp.task('html', () => {
    configuredExtensions.push('html');
    return gulp.src([
            'src/**/*.html',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(htmlmin({
            collapseWhitespace: true,
            minifyCSS: true,
            minifyJS: true
        }))
        .pipe(gulp.dest('bin'));
});

gulp.task('scss', () => {
    configuredExtensions.push('sass');
    configuredExtensions.push('scss');
    return gulp.src([
            'src/**/*.{scss,sass}',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(scss())
        .pipe(minifyCSS())
        .pipe(gulp.dest('bin'));
});

gulp.task('css', () => {
    configuredExtensions.push('css');
    return gulp.src([
            'src/**/*.css',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(minifyCSS())
        .pipe(gulp.dest('bin'));
});

gulp.task('js', () => {
    configuredExtensions.push('js');
    return gulp.src([
            'src/**/*.js',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(preprocess())
        // .pipe(uglify())
        // .pipe(minify({
        //     ext: {
        //         min: '.js'
        //     },
        //     noSource: true
        // }))
        .pipe(gulp.dest('bin'));
});

gulp.task('ts', () => {
    configuredExtensions.push('ts');
    return gulp.src([
            'src/**/*.ts',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(preprocess())
        .pipe(tsProject())
        // .pipe(uglify())
        // .pipe(minify({
        //     ext: {
        //         min: '.js'
        //     },
        //     noSource: true
        // }))
        .pipe(gulp.dest('bin'));
});

gulp.task('images', () => {
    configuredExtensions.push('png');
    configuredExtensions.push('jpg');
    configuredExtensions.push('jpeg');
    configuredExtensions.push('gif');
    configuredExtensions.push('tif');
    return gulp.src([
            'src/**/*.{png,jpg,jpeg,gif,tif}',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(gulp.dest('bin'));
});

gulp.task('pretty-data', () => {
    configuredExtensions.push('xml');
    configuredExtensions.push('json');
    configuredExtensions.push('xlf');
    configuredExtensions.push('svg');
    return gulp.src([
            'src/**/*.{xml,json,xlf,svg}',
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(prettyData({
            type: "minify",
            preserveComments: false
        }))
        .pipe(gulp.dest('bin'));
});

gulp.task('copy', () => {
    return gulp.src([
            'src/**/*',
            `!src/**/*.{${configuredExtensions.join(',')}}`,
            '!src/**/node_modules/',
            '!src/**/node_modules/**/*'
        ])
        .pipe(newer('bin'))
        .pipe(gulp.dest('bin'));
});


gulp.task('clean', () => {
    return gulp.src('bin')
        .pipe(clean());
});

gulp.task('zip', function() {
    return gulp.src(['bin/**',
            '!bin/testes',
            '!bin/testes/',
            '!bin/testes/**/*'
        ])
        .pipe(zip('backup.zip'))
        .pipe(gulp.dest('dist'));
});

gulp.task('backup', function() {
    return gulp.src(['src/**',
            '!src/lib',
            '!src/lib/',
            '!src/lib/**/*'
        ])
        .pipe(zip('backup' + (() => {
            let agora = new Date();
            return agora.toLocaleDateString().replace(/[\/\\-]/g, '_') + '_' + (('0' + agora.getHours().toString()).replace(/0([0-9]{2})/, '$1')) + '_' + (('0' + agora.getMinutes().toString()).replace(/0([0-9]{2})/, '$1'));
        })() + '.zip'))
        .pipe(gulp.dest('backup'));
});

gulp.task('backup__', function() {
    return gulp.src(['**',
            '!node_modules',
            '!node_modules/',
            '!node_modules/**/*',
            '!backup',
            '!backup/',
            '!backup/**/*',
            '!backup__',
            '!backup__/',
            '!backup__/**/*',
            '!bin',
            '!bin/',
            '!bin/**/*',
            '!dist',
            '!dist/',
            '!dist/**/*',
        ])
        .pipe(zip('backup__' + (() => {
            let agora = new Date();
            return agora.toLocaleDateString().replace(/[\/\\-]/g, '_');
        })() + '.zip'))
        .pipe(gulp.dest('backup__'));
});

gulp.task('default', gulp.series('html', 'scss', 'css', 'ts', 'images', 'pretty-data', 'js', 'copy', 'zip', 'backup', 'backup__'));
gulp.task('build', gulp.series('default'));
gulp.task('rebuild', gulp.series('default'));
gulp.task('clean', gulp.series('clean'));