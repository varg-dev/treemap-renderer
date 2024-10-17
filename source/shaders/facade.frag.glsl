
// @todo this file will be included from webgl-operate soon

#if __VERSION__ == 100
    #define texture(sampler, coord) texture2D(sampler, coord)
#else
    #define varying in
#endif
