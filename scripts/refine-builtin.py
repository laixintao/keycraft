import re
import sys
import csv

write_header = True


with open(sys.argv[1], "r") as f:
    with open(sys.argv[2], "w+") as w:
        csvreader = csv.DictReader(f)
        csvwriter = None
        for line in csvreader:
            print(line)
            if write_header:
                csvwriter = csv.DictWriter(w, fieldnames=line.keys())
                write_header = False
            line['rhs'] = line['rhs'].strip("\t\n\r")
            csvwriter.writerow(line)
