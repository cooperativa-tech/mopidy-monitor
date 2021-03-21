sudo ln -s /home/cpi/mopidy-monitor/icecastmonitor.service /etc/systemd/system/icecastmonitor.service;
systemctl enable icecastmonitor.service;
systemctl start icecastmonitor.service;
systemctl status icecastmonitor.service;
