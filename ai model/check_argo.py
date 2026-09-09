import xarray as xr
ds = xr.open_dataset("data/interim/common_grid_stack.nc")
sst_day1 = ds.sst.isel(time=0)
print("Total cells:", sst_day1.size)
print("NaN cells:", int(sst_day1.isnull().sum()))
print("Valid (ocean) cells:", int((~sst_day1.isnull()).sum()))