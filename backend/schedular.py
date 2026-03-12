import schedule
import time

def scheduler(my_function, interval):
    schedule.every(interval).minutes.do(my_function)
    while True:
        schedule.run_pending()
        time.sleep(1)
