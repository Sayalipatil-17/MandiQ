from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

options = webdriver.ChromeOptions()
options.add_argument("--disable-gpu")
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
driver.get("https://agmarknet.gov.in/alltypeofreports")
time.sleep(6)

# Type = Market Wise
label = driver.find_element("xpath", "//*[normalize-space(text())='Type']")
parent = driver.execute_script("return arguments[0].parentElement;", label)
btn = driver.execute_script("return arguments[0].children[0];", parent)
driver.execute_script("arguments[0].click();", btn)
time.sleep(1.5)
mw = driver.find_element("xpath", "//*[self::div or self::span][normalize-space(text())='Market Wise']")
driver.execute_script("arguments[0].click();", mw)
time.sleep(2)

# State = NCT of Delhi
label2 = driver.find_element("xpath", "//*[normalize-space(text())='State']")
parent2 = driver.execute_script("return arguments[0].parentElement;", label2)
btn2 = driver.execute_script("return arguments[0].children[0];", parent2)
driver.execute_script("arguments[0].click();", btn2)
time.sleep(1.5)
inp = driver.find_element("xpath", "//input[@placeholder='Filter State']")
inp.send_keys("NCT")
time.sleep(1.5)
opt = driver.find_element("xpath", "//div[normalize-space(text())='NCT of Delhi']")
driver.execute_script("arguments[0].click();", opt)
time.sleep(2)

# Market dropdown open karo aur saare options print karo
label3 = driver.find_element("xpath", "//*[normalize-space(text())='Market']")
parent3 = driver.execute_script("return arguments[0].parentElement;", label3)
btn3 = driver.execute_script("return arguments[0].children[0];", parent3)
driver.execute_script("arguments[0].click();", btn3)
time.sleep(2)

all_opts = driver.find_elements("xpath", "//div[contains(@class,'cursor-pointer')]")
for o in all_opts:
    if o.text.strip():
        print(repr(o.text.strip()))

input("Press Enter...")
driver.quit()
