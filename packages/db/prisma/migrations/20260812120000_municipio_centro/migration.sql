-- Centro geográfico del municipio.
--
-- Los mapas arrancaban en el centro de Colombia y solo se acercaban cuando ya
-- había datos propios que encuadrar (puestos con electores, comunas con
-- límites). Una campaña recién creada no tiene ninguno de los dos, así que el
-- mapa se quedaba mostrando el país entero aunque el municipio estuviera
-- configurado. DIVIPOLA no trae coordenadas, así que se guardan aquí y se
-- rellenan geocodificando una sola vez por municipio.
ALTER TABLE "Municipality"
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION;
