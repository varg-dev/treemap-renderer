
// @todo this file will be included from webgl-operate soon

void ndcOffset(inout vec4 vertex, in vec2 offset) {
    vertex.xy = offset * vec2(vertex.w) + vertex.xy;
}
