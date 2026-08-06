# Sama persis dengan template asli — generate self-signed cert otomatis
# saat build (cukup buat awal/testing). Untuk production sungguhan, ganti
# server.crt/server.key dengan certificate asli (lihat .docker/README.md).
FROM nginx:1.25.4

RUN openssl req -newkey rsa:1024 -x509 -nodes -set_serial 1 -days 3650 \
  -subj '/C=US/ST=NY/L=NY' -keyout '/etc/ssl/private/server.key' -out '/etc/ssl/private/server.crt' \
  && chmod 400 /etc/ssl/private/server.*
