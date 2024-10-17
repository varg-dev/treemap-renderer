
#if __VERSION__ == 100
    #extension GL_EXT_draw_buffers : enable
#endif

precision highp float;
precision lowp int;

#include ./facade.vert.glsl;
#include ./ndc_offset.glsl;


#if __VERSION__ == 100
attribute vec3 a_vertex;
attribute vec4 a_color;
#else
/* Note: do not use layout location specifier, since they take precedence over CPU managed locations. */
in vec3 a_vertex;
in vec4 a_color;
#endif

uniform mat4 u_viewProjection;
uniform vec2 u_ndcOffset;
uniform float u_pointSize;

varying vec4 v_color;

void main(void)
{
    vec4 vertex = u_viewProjection * vec4(a_vertex, 1.0);

    v_color = a_color;

    ndcOffset(vertex, u_ndcOffset);
    gl_Position = vertex;
    gl_PointSize = u_pointSize;
}
