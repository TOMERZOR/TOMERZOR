cd /home/user/TOMERZOR/pointy-ad/max2/real
for i in $(seq 1 40); do
  c=$(curl -sS -o /dev/null -w "%{http_code}" https://cdn.freesound.org/previews/467/467490_2639035-hq.mp3)
  echo "$(date +%T) cdn $c"; [ "$c" = "200" ] && break; sleep 60
done
python3 fetch.py
